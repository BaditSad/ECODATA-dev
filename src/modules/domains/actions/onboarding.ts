"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import {
  DEFAULT_ROTATION_POLICY,
  generateLobbyCode,
  normalizeLobbyCode,
  windowForCycle,
} from "@/lib/pin-engine";
import { isValidSlug, slugify } from "@/lib/slug";
import { domainsWriter } from "./shared";

/**
 * Resort onboarding.
 *
 * Creating a domain is the one operation that has to leave a resort usable in
 * a single step: a row in `tenants` alone would authenticate nobody. So this
 * also issues the lobby code its hall display pairs with, the first guest PIN
 * cycle, the display settings row the portal edits, and optionally the manager
 * account that will run the property.
 *
 * Those follow-ups are deliberately not transactional. Once the tenant row
 * exists the onboarding has succeeded, and every remaining step is repairable
 * from the resort page — rotate a code, invite a manager. Rolling the whole
 * thing back because an email address was already taken would be worse.
 */

function createTenantSchema() {
  return z.object({
    name: z.string().trim().min(2, notice("resortNameShort")).max(255),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(255)
      .refine(isValidSlug, notice("slugHyphens")),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, notice("countryIso"))
      .optional(),
    timezone: z.string().trim().min(1).max(64),
    subscriptionStatus: z.enum(["trial", "active"]),
    sensorQuota: z.coerce.number().int().min(0).max(512),
    lobbyCode: z.string().trim().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    managerEmail: z.string().trim().toLowerCase().email().optional(),
    managerName: z.string().trim().max(255).optional(),
  });
}

export interface OnboardedTenantPayload {
  tenantId: string;
  name: string;
  slug: string;
  /** Permanent kiosk code. Recoverable later from the resort page. */
  lobbyCode: string;
  /** First guest PIN, or null if the cycle could not be issued. */
  guestPin: string | null;
  /** Manager credentials, shown once. Null when no manager was requested. */
  manager: { email: string; temporaryPassword: string } | null;
  /** Set when the tenant exists but a follow-up step needs operator attention. */
  warning: string | null;
}

/** Span the guest and lobby twins fall back to before an asset is published. */
const DEFAULT_SPAN_METERS = 400;

/**
 * A first password the manager is expected to change.
 *
 * Shown once, like a sensor key: local and self-hosted deployments have no
 * outbound mail, so an invite link would strand the operator. The alphabet
 * drops glyphs that are ambiguous when a password is read aloud over a call.
 */
function generateTemporaryPassword(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXYacdefghjkmnpqrtuvwxy34679";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}

export async function createTenant(
  formData: FormData
): Promise<ActionResult<OnboardedTenantPayload>> {
  const actor = await domainsWriter();
  if (!actor) return denied("domains");

  const rawName = String(formData.get("name") ?? "");
  const rawSlug = String(formData.get("slug") ?? "").trim();

  const parsed = createTenantSchema().safeParse({
    name: rawName,
    // An operator who leaves the slug blank gets the one the form previewed.
    slug: rawSlug || slugify(rawName),
    countryCode: formData.get("countryCode") || undefined,
    timezone: formData.get("timezone") || "UTC",
    subscriptionStatus: formData.get("subscriptionStatus") || "trial",
    sensorQuota: formData.get("sensorQuota") || 7,
    lobbyCode: formData.get("lobbyCode") || undefined,
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    managerEmail: formData.get("managerEmail") || undefined,
    managerName: formData.get("managerName") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidOnboarding"),
    };
  }

  const input = parsed.data;

  let lobbyCode: string;
  if (input.lobbyCode && input.lobbyCode.length > 0) {
    const normalized = normalizeLobbyCode(input.lobbyCode);
    if (!normalized) {
      return {
        ok: false,
        message: notice("lobbyCodeCharset"),
      };
    }
    lobbyCode = normalized;
  } else {
    lobbyCode = generateLobbyCode(input.slug);
  }

  // Only georeference when both coordinates are given: a half-specified fix
  // would drop the twin on the equator or the prime meridian.
  const hasFix = input.latitude !== undefined && input.longitude !== undefined;

  const supabase = createAdminSupabase();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      master_lobby_code: lobbyCode,
      country_code: input.countryCode ?? null,
      timezone: input.timezone,
      subscription_status: input.subscriptionStatus,
      sensor_quota: input.sensorQuota,
      coordinates: hasFix
        ? {
            lat: input.latitude as number,
            lon: input.longitude as number,
            alt: 0,
            headingDeg: 0,
            spanMeters: DEFAULT_SPAN_METERS,
          }
        : null,
    })
    .select("id, name, slug, created_at")
    .single();

  if (error || !tenant) {
    if (error?.code === "23505") {
      return {
        ok: false,
        message: notice("slugOrLobbyTaken", { slug: input.slug, code: lobbyCode }),
      };
    }
    return {
      ok: false,
      message: notice("failCreateResort", {
        detail: error?.message ?? notice("unknownError"),
      }),
    };
  }

  const warnings: string[] = [];

  // ── First guest PIN cycle ────────────────────────────────────────────────
  // Anchored on the tenant's own creation timestamp, which is what every later
  // rotation derives its windows from.
  const window = windowForCycle(
    new Date(tenant.created_at),
    0,
    DEFAULT_ROTATION_POLICY
  );

  const { data: issuedCode, error: codeError } = await supabase.rpc(
    "rotate_tenant_access_code",
    {
      target_tenant: tenant.id,
      target_cycle: 0,
      window_from: window.validFrom.toISOString(),
      window_until: window.validUntil.toISOString(),
      actor: actor.userId,
    }
  );

  if (codeError) {
    warnings.push(
      codeError.code === "53400"
        ? notice("keyspaceExhaustedOnboard")
        : notice("noGuestCodeIssued", { detail: codeError.message })
    );
  }

  // ── Hall display defaults ────────────────────────────────────────────────
  // The portal upserts these, but seeding the row means the display is
  // configurable from the first minute rather than after a first save.
  const { error: settingsError } = await supabase
    .from("lobby_display_settings")
    .insert({ tenant_id: tenant.id, updated_by: actor.userId });

  if (settingsError) {
    warnings.push(
      notice("hallDisplayDefaults", { detail: settingsError.message })
    );
  }

  // ── Resort manager ───────────────────────────────────────────────────────
  let manager: OnboardedTenantPayload["manager"] = null;

  if (input.managerEmail) {
    const managerResult = await createResortManager({
      email: input.managerEmail,
      fullName: input.managerName ?? null,
      tenantId: tenant.id,
    });

    if (managerResult.ok) {
      manager = managerResult.manager;
    } else {
      warnings.push(managerResult.reason);
    }
  }

  revalidatePath("/admin/domains");
  revalidatePath("/admin");

  return {
    ok: true,
    message: notice("domainOnboarded", { name: tenant.name }),
    data: {
      tenantId: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      lobbyCode,
      guestPin: issuedCode?.code ?? null,
      manager,
      warning: warnings.length > 0 ? warnings.join(" ") : null,
    },
  };
}

type ManagerResult =
  | { ok: true; manager: { email: string; temporaryPassword: string } }
  | { ok: false; reason: string };

/**
 * Create the account that will run a resort.
 *
 * `handle_new_auth_user` inserts a signup carrying a tenant id as an inactive
 * `csr_analyst`, so the profile has to be promoted afterwards. That ordering is
 * the safe one: a signup that fails halfway leaves an account that can read
 * nothing.
 */
async function createResortManager({
  email,
  fullName,
  tenantId,
}: {
  email: string;
  fullName: string | null;
  tenantId: string;
}): Promise<ManagerResult> {
  // The operator address is promoted to super_admin by the signup trigger, and
  // a super_admin must not carry a tenant. Pinning it here would violate the
  // profile role/tenant constraint.
  if (email === serverEnv().SUPER_ADMIN_EMAIL.toLowerCase()) {
    return {
      ok: false,
      reason: notice("operatorCannotManage"),
    };
  }

  const supabase = createAdminSupabase();
  const temporaryPassword = generateTemporaryPassword();

  const { data: created, error: signUpError } =
    await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      // Self-hosted and local deployments have no outbound mail; requiring a
      // confirmation click would lock the manager out of their own resort.
      email_confirm: true,
      user_metadata: { full_name: fullName, tenant_id: tenantId },
    });

  if (signUpError || !created.user) {
    return {
      ok: false,
      reason: notice("managerNotCreated", {
        detail: signUpError?.message ?? notice("unknownError"),
      }),
    };
  }

  const { error: promoteError } = await supabase
    .from("profiles")
    .update({
      role: "resort_manager",
      tenant_id: tenantId,
      full_name: fullName,
      is_active: true,
    })
    .eq("id", created.user.id);

  if (promoteError) {
    return {
      ok: false,
      reason: notice("createdNotActivated", { email, detail: promoteError.message }),
    };
  }

  return { ok: true, manager: { email, temporaryPassword } };
}
