"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { authorizeModule } from "@/lib/auth/erp";
import { requireStaff } from "@/lib/auth/guards";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import type { TicketPriority } from "@/types/database";

const uuid = z.string().uuid();
const priority = z.enum(["low", "normal", "high", "urgent"]);

async function writer() {
  return authorizeModule("incidents", "write");
}

function revalidate(incidentId?: string): void {
  revalidatePath("/admin/incidents");
  revalidatePath("/admin");
  revalidatePath("/hotel-portal");
  if (incidentId) revalidatePath(`/admin/incidents/${incidentId}`);
}

export async function setIncidentStatus(
  incidentId: string,
  next: "closed" | "suspended" | "archived"
): Promise<ActionResult> {
  if (!(await writer())) return denied("incidents");
  if (!uuid.safeParse(incidentId).success) {
    return { ok: false, message: notice("invalidIncident") };
  }

  const supabase = createAdminSupabase();
  const { data: current, error: lookupError } = await supabase
    .from("hotel_incidents")
    .select("status, closed_at, archived_at")
    .eq("id", incidentId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, message: notice("failLoadIncident", { detail: lookupError.message }) };
  }
  if (!current) return { ok: false, message: notice("incidentNotFound") };

  const now = new Date().toISOString();
  const patch: {
    status: typeof next;
    closed_at: string | null;
    archived_at: string | null;
  } = {
    status: next,
    closed_at: current.closed_at,
    archived_at: current.archived_at,
  };

  if (next === "closed") {
    patch.closed_at = current.closed_at ?? now;
    patch.archived_at = null;
  } else if (next === "archived") {
    patch.archived_at = current.archived_at ?? now;
    patch.closed_at = current.closed_at ?? now;
  } else {
    patch.archived_at = null;
  }

  const { error } = await supabase
    .from("hotel_incidents")
    .update(patch)
    .eq("id", incidentId);

  if (error) return { ok: false, message: notice("failUpdate", { detail: error.message }) };

  revalidate(incidentId);
  return {
    ok: true,
    message:
      next === "archived"
        ? notice("incidentArchived")
        : next === "closed"
          ? notice("incidentClosed")
          : notice("incidentSuspended"),
  };
}

export async function archiveIncident(incidentId: string): Promise<ActionResult> {
  return setIncidentStatus(incidentId, "archived");
}

export async function deleteIncident(incidentId: string): Promise<ActionResult> {
  if (!(await writer())) return denied("incidents");
  if (!uuid.safeParse(incidentId).success) {
    return { ok: false, message: notice("invalidIncident") };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase.from("hotel_incidents").delete().eq("id", incidentId);

  if (error) return { ok: false, message: notice("failDelete", { detail: error.message }) };

  revalidate(incidentId);
  return { ok: true, message: notice("incidentDeleted") };
}

/** Closed incidents from previous UTC months become archives. */
export async function archiveStaleClosedIncidents(): Promise<void> {
  if (!(await authorizeModule("incidents", "read"))) return;

  const supabase = createAdminSupabase();
  const cutoff = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  ).toISOString();
  const now = new Date().toISOString();

  await supabase
    .from("hotel_incidents")
    .update({ status: "archived", archived_at: now })
    .eq("status", "closed")
    .lt("closed_at", cutoff);

  await supabase
    .from("hotel_incidents")
    .update({ status: "archived", archived_at: now })
    .eq("status", "closed")
    .is("closed_at", null)
    .lt("updated_at", cutoff);
}

/**
 * Resort staff open an incident for their own hotel. Assignment stays in the ERP.
 */
export async function reportHotelIncident(
  formData: FormData
): Promise<ActionResult> {
  const staff = await requireStaff();

  const parsed = z
    .object({
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().min(4).max(8000),
      priority,
    })
    .safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority") || "normal",
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? notice("invalidIncident") };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from("hotel_incidents").insert({
    tenant_id: staff.tenantId,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority as TicketPriority,
    created_by: staff.userId,
  });

  if (error) {
    return { ok: false, message: notice("failReportIncident", { detail: error.message }) };
  }

  revalidate();
  return { ok: true, message: notice("incidentSent") };
}
