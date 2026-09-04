"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditTenantSettings, requireStaff } from "@/lib/auth/guards";
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
