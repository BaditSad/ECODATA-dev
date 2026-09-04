"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditTenantSettings, requireStaff } from "@/lib/auth/guards";
import { canonicalCidr, generateRemotePassToken } from "@/lib/auth/network";
import { suggestCidr } from "@/lib/auth/cidr";
import { clientIpFromHeaders } from "@/lib/auth/client-ip";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Resort staff mutations.
 *
 * Two guards, both necessary. `requireStaff()` establishes *which* tenant the
 * caller belongs to, and that tenant id — never one from the request — is what
 * gets written. `canEditTenantSettings()` then separates managers, who may
 * change lobby presentation, from CSR analysts, who are read-mostly.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
  remoteUrl?: string;
  remoteExpiresAt?: string;
}

const lobbySettingsSchema = z.object({
  featuredSpeciesId: z.string().uuid().nullable(),
  soundscapeMode: z.enum(["muted", "ambient", "live_detections"]),
  soundscapeVolume: z.coerce.number().int().min(0).max(100),
  cameraMode: z.enum(["orbit", "flyover", "static"]),
  orbitPeriodS: z.coerce.number().int().min(20).max(600),
  showLiveAlerts: z.boolean(),
  showSpeciesNames: z.boolean(),
  locale: z.enum(["fr", "en"]),
});

export async function updateLobbySettings(
  formData: FormData
): Promise<ActionResult> {
  const staff = await requireStaff();

  if (!canEditTenantSettings(staff.role)) {
    return {
      ok: false,
      message: "Lobby display settings are managed by the resort manager.",
    };
  }

  const featured = formData.get("featuredSpeciesId");

  const parsed = lobbySettingsSchema.safeParse({
    featuredSpeciesId:
      typeof featured === "string" && featured.length > 0 ? featured : null,
    soundscapeMode: formData.get("soundscapeMode"),
    soundscapeVolume: formData.get("soundscapeVolume"),
    cameraMode: formData.get("cameraMode"),
    orbitPeriodS: formData.get("orbitPeriodS"),
    showLiveAlerts: formData.get("showLiveAlerts") === "on",
    showSpeciesNames: formData.get("showSpeciesNames") === "on",
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid display settings.",
    };
  }

  const input = parsed.data;

  // The RLS-scoped client, not the service role: this write should be subject
  // to `lobby_settings_manager_write_own` so the policy is genuinely exercised.
  const supabase = createServerSupabase();

  const { error } = await supabase.from("lobby_display_settings").upsert(
    {
      // Taken from the verified session, so a forged `tenant_id` in the form
      // body cannot retarget another resort's displays.
      tenant_id: staff.tenantId,
      featured_species_id: input.featuredSpeciesId,
      soundscape_mode: input.soundscapeMode,
      soundscape_volume: input.soundscapeVolume,
      camera_mode: input.cameraMode,
      orbit_period_s: input.orbitPeriodS,
      show_live_alerts: input.showLiveAlerts,
      show_species_names: input.showSpeciesNames,
      locale: input.locale,
      updated_by: staff.userId,
      // `updated_at` is stamped by the `touch_updated_at` trigger; setting it
      // here would let a clock-skewed app server overwrite the database's own
      // ordering.
    },
    { onConflict: "tenant_id" }
  );

  if (error) {
    return { ok: false, message: `Could not save display settings: ${error.message}` };
  }

  revalidatePath("/hotel-portal");
  // The kiosk reads these on its own polling cycle, so it picks the change up
  // without an operator touching the display.
  revalidatePath("/lobby");

  return { ok: true, message: "Lobby display updated. Screens refresh within a minute." };
}

const reviewSchema = z.object({
  detectionId: z.string().uuid(),
  state: z.enum(["confirmed", "rejected", "unreviewed"]),
});

/**
 * Confirm or reject a model call.
 *
 * Rejected detections are excluded from guest views and from TNFD evidence, so
 * this is a substantive editorial decision rather than a cosmetic flag.
 */
export async function reviewDetection(
  detectionId: string,
  state: "confirmed" | "rejected" | "unreviewed"
): Promise<ActionResult> {
  const staff = await requireStaff();

  const parsed = reviewSchema.safeParse({ detectionId, state });
  if (!parsed.success) {
    return { ok: false, message: "Invalid review request." };
  }

  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("audio_detections")
    .update({
      review_state: parsed.data.state,
      reviewed_by: parsed.data.state === "unreviewed" ? null : staff.userId,
      reviewed_at:
        parsed.data.state === "unreviewed" ? null : new Date().toISOString(),
    })
    .eq("id", parsed.data.detectionId)
    .eq("tenant_id", staff.tenantId);

  if (error) {
    return { ok: false, message: `Could not record the review: ${error.message}` };
  }

  revalidatePath("/hotel-portal");
  return {
    ok: true,
    message:
      parsed.data.state === "rejected"
        ? "Detection rejected. It is now excluded from guest views and TNFD evidence."
        : "Detection confirmed.",
  };
}

async function requireManager() {
  const staff = await requireStaff();
  if (!canEditTenantSettings(staff.role)) {
    return {
      staff: null,
      error: {
        ok: false as const,
        message: "Network access is managed by the resort manager.",
      },
    };
  }
  return { staff, error: null };
}

function requestOrigin(): string {
  const headerList = headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

const hoursSchema = z.object({
  onNetworkHours: z.coerce.number().int().min(1).max(24),
  remoteSessionHours: z.coerce.number().int().min(1).max(12),
});

export async function updateAccessWindows(formData: FormData): Promise<ActionResult> {
  const { staff, error } = await requireManager();
  if (error || !staff) return error;

  const parsed = hoursSchema.safeParse({
    onNetworkHours: formData.get("onNetworkHours"),
    remoteSessionHours: formData.get("remoteSessionHours"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid windows." };
  }

  const supabase = createServerSupabase();
  const { error: writeError } = await supabase
    .from("tenants")
    .update({
      on_network_hours: parsed.data.onNetworkHours,
      remote_session_hours: parsed.data.remoteSessionHours,
    })
    .eq("id", staff.tenantId);

  if (writeError) {
    return { ok: false, message: `Could not save access windows: ${writeError.message}` };
  }

  revalidatePath("/hotel-portal");
  return {
    ok: true,
    message: `On Wi-Fi: ${parsed.data.onNetworkHours}h. Off-site: ${parsed.data.remoteSessionHours}h.`,
  };
}

export async function claimCurrentNetwork(): Promise<ActionResult> {
  const { staff, error } = await requireManager();
  if (error || !staff) return error;

  const suggested = suggestCidr(clientIpFromHeaders(headers()) ?? "");
  if (!suggested) {
    return {
      ok: false,
      message: "Could not see this connection's address. Enter a prefix manually.",
    };
  }

  return addNetworkCidr(suggested);
}

export async function addNetworkCidr(raw: string): Promise<ActionResult> {
  const { staff, error } = await requireManager();
  if (error || !staff) return error;

  const cidr = canonicalCidr(raw);
  if (!cidr) {
    return {
      ok: false,
      message:
        "That prefix is not usable. IPv4 must be /8–/32 (not 0.0.0.0); IPv6 /32–/128.",
    };
  }

  const supabase = createServerSupabase();
  const { data: tenant, error: readError } = await supabase
    .from("tenants")
    .select("network_cidrs")
    .eq("id", staff.tenantId)
    .maybeSingle();

  if (readError || !tenant) {
    return { ok: false, message: "Could not load the current network list." };
  }

  const current = tenant.network_cidrs ?? [];
  if (current.length >= 16) {
    return { ok: false, message: "A resort may register at most 16 prefixes." };
  }
  if (current.includes(cidr)) {
    return { ok: true, message: `${cidr} is already registered.` };
  }

  const { error: writeError } = await supabase
    .from("tenants")
    .update({ network_cidrs: [...current, cidr] })
    .eq("id", staff.tenantId);

  if (writeError) {
    return { ok: false, message: `Could not register the prefix: ${writeError.message}` };
  }

  revalidatePath("/hotel-portal");
  return {
    ok: true,
    message: `${cidr} now admits guest and hall screens without a code.`,
  };
}

export async function addNetworkCidrFromForm(formData: FormData): Promise<ActionResult> {
  const raw = String(formData.get("cidr") ?? "");
  return addNetworkCidr(raw);
}

export async function removeNetworkCidr(cidr: string): Promise<ActionResult> {
  const { staff, error } = await requireManager();
  if (error || !staff) return error;

  const supabase = createServerSupabase();
  const { data: tenant, error: readError } = await supabase
    .from("tenants")
    .select("network_cidrs")
    .eq("id", staff.tenantId)
    .maybeSingle();

  if (readError || !tenant) {
    return { ok: false, message: "Could not load the current network list." };
  }

  const next = (tenant.network_cidrs ?? []).filter((entry) => entry !== cidr);
  const { error: writeError } = await supabase
    .from("tenants")
    .update({ network_cidrs: next })
    .eq("id", staff.tenantId);

  if (writeError) {
    return { ok: false, message: `Could not remove the prefix: ${writeError.message}` };
  }

  revalidatePath("/hotel-portal");
  return { ok: true, message: `${cidr} no longer admits without a code.` };
}

const remotePassSchema = z.object({
  tier: z.enum(["guest", "lobby"]),
  label: z.string().trim().max(80).optional(),
});

export async function issueRemotePass(formData: FormData): Promise<ActionResult> {
  const { staff, error } = await requireManager();
  if (error || !staff) return error;

  const parsed = remotePassSchema.safeParse({
    tier: formData.get("tier"),
    label: formData.get("label") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Choose guest view or hall display." };
  }

  const supabase = createServerSupabase();
  const { data: tenant, error: readError } = await supabase
    .from("tenants")
    .select("remote_session_hours")
    .eq("id", staff.tenantId)
    .maybeSingle();

  if (readError || !tenant) {
    return { ok: false, message: "Could not load remote session hours." };
  }

  const { raw, hash } = await generateRemotePassToken();
  const expiresAt = new Date(
    Date.now() + tenant.remote_session_hours * 60 * 60 * 1000
  ).toISOString();

  const { error: writeError } = await supabase.from("remote_access_passes").insert({
    tenant_id: staff.tenantId,
    tier: parsed.data.tier,
    token_hash: hash,
    label: parsed.data.label || null,
    expires_at: expiresAt,
    created_by: staff.userId,
  });

  if (writeError) {
    return { ok: false, message: `Could not issue the pass: ${writeError.message}` };
  }

  const path = parsed.data.tier === "guest" ? "/client/login" : "/lobby/pair";
  revalidatePath("/hotel-portal");
  return {
    ok: true,
    message: "Copy this link now — it cannot be shown again.",
    remoteUrl: `${requestOrigin()}${path}?pass=${raw}`,
    remoteExpiresAt: expiresAt,
  };
}

export async function revokeRemotePass(passId: string): Promise<ActionResult> {
  const { staff, error } = await requireManager();
  if (error || !staff) return error;

  const parsed = z.string().uuid().safeParse(passId);
  if (!parsed.success) return { ok: false, message: "Invalid pass." };

  const supabase = createServerSupabase();
  const { error: writeError } = await supabase
    .from("remote_access_passes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("tenant_id", staff.tenantId);

  if (writeError) {
    return { ok: false, message: `Could not revoke the pass: ${writeError.message}` };
  }

  revalidatePath("/hotel-portal");
  return { ok: true, message: "Remote link revoked." };
}
