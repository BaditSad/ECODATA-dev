"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { authorizeModule } from "@/lib/auth/erp";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import type { TicketDepartment, TicketPriority, TicketStatus } from "@/types/database";

const uuid = z.string().uuid();
const department = z.enum(["it", "commerce", "marketing"]);
const priority = z.enum(["low", "normal", "high", "urgent"]);
const ticketStatus = z.enum([
  "draft",
  "waiting",
  "in_progress",
  "done",
  "archived",
]);

function utcMonthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function statusTimestamps(
  next: TicketStatus,
  previous: TicketStatus,
  existing: { completed_at: string | null; archived_at: string | null }
): { completed_at: string | null; archived_at: string | null } {
  const now = new Date().toISOString();
  const completed_at =
    next === "done"
      ? previous === "done"
        ? existing.completed_at ?? now
        : now
      : next === "archived"
        ? existing.completed_at
        : null;
  const archived_at =
    next === "archived"
      ? previous === "archived"
        ? existing.archived_at ?? now
        : now
      : null;
  return { completed_at, archived_at };
}

async function writer() {
  return authorizeModule("tickets", "write");
}

function revalidate(ticketId?: string): void {
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/incidents");
  revalidatePath("/admin");
  if (ticketId) revalidatePath(`/admin/tickets/${ticketId}`);
}

export async function createWorkTicket(
  formData: FormData
): Promise<ActionResult<{ ticketId: string }>> {
  const session = await writer();
  if (!session) return denied("tickets");

  const assignedRaw = String(formData.get("assignedTo") ?? "");
  const parsed = z
    .object({
      department,
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().min(4).max(8000),
      priority,
      assignedTo: z.string().uuid().nullable(),
      sourceIncidentId: z.string().uuid().nullable(),
    })
    .safeParse({
      department: formData.get("department"),
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority") || "normal",
      assignedTo: assignedRaw.length > 0 ? assignedRaw : null,
      sourceIncidentId: String(formData.get("sourceIncidentId") ?? "") || null,
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? notice("invalidTicket") };
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("work_tickets")
    .insert({
      department: parsed.data.department as TicketDepartment,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority as TicketPriority,
      assigned_to: parsed.data.assignedTo,
      created_by: session.userId,
      source_incident_id: parsed.data.sourceIncidentId,
      status: "draft" as TicketStatus,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: notice("failCreateTicket", {
        detail: error?.message ?? notice("unknownError"),
      }),
    };
  }

  revalidate(data.id);
  return { ok: true, message: notice("ticketCreated"), data: { ticketId: data.id } };
}

export async function updateWorkTicket(
  formData: FormData
): Promise<ActionResult> {
  if (!(await writer())) return denied("tickets");

  const assignedRaw = String(formData.get("assignedTo") ?? "");
  const parsed = z
    .object({
      ticketId: uuid,
      department,
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().min(4).max(8000),
      priority,
      assignedTo: z.string().uuid().nullable(),
    })
    .safeParse({
      ticketId: formData.get("ticketId"),
      department: formData.get("department"),
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority"),
      assignedTo: assignedRaw.length > 0 ? assignedRaw : null,
    });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidUpdate"),
    };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("work_tickets")
    .update({
      department: parsed.data.department as TicketDepartment,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority as TicketPriority,
      assigned_to: parsed.data.assignedTo,
    })
    .eq("id", parsed.data.ticketId);

  if (error) return { ok: false, message: notice("failSave", { detail: error.message }) };

  revalidate(parsed.data.ticketId);
  return { ok: true, message: notice("ticketUpdated") };
}

export async function setTicketStatus(
  ticketId: string,
  next: TicketStatus
): Promise<ActionResult> {
  if (!(await writer())) return denied("tickets");

  const parsed = z
    .object({ ticketId: uuid, next: ticketStatus })
    .safeParse({ ticketId, next });
  if (!parsed.success) return { ok: false, message: notice("invalidTicketStatus") };

  const supabase = createAdminSupabase();
  const { data: current, error: lookupError } = await supabase
    .from("work_tickets")
    .select("status, completed_at, archived_at")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, message: notice("failLoadTicket", { detail: lookupError.message }) };
  }
  if (!current) return { ok: false, message: notice("ticketNotFound") };

  const previous = current.status as TicketStatus;
  const timestamps = statusTimestamps(parsed.data.next, previous, {
    completed_at: current.completed_at,
    archived_at: current.archived_at,
  });

  const { error } = await supabase
    .from("work_tickets")
    .update({
      status: parsed.data.next,
      completed_at: timestamps.completed_at,
      archived_at: timestamps.archived_at,
    })
    .eq("id", parsed.data.ticketId);

  if (error) return { ok: false, message: notice("failMoveTicket", { detail: error.message }) };

  revalidate(parsed.data.ticketId);
  return {
    ok: true,
    message:
      parsed.data.next === "archived" ? notice("ticketArchived") : notice("ticketMoved"),
  };
}

export async function archiveWorkTicket(ticketId: string): Promise<ActionResult> {
  return setTicketStatus(ticketId, "archived");
}

export async function deleteWorkTicket(ticketId: string): Promise<ActionResult> {
  if (!(await writer())) return denied("tickets");

  const parsed = uuid.safeParse(ticketId);
  if (!parsed.success) return { ok: false, message: notice("invalidTicket") };

  const supabase = createAdminSupabase();
  const { data: current, error: lookupError } = await supabase
    .from("work_tickets")
    .select("status")
    .eq("id", parsed.data)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, message: notice("failLoadTicket", { detail: lookupError.message }) };
  }
  if (!current) return { ok: false, message: notice("ticketNotFound") };
  if (current.status !== "archived") {
    return { ok: false, message: notice("onlyArchivedDelete") };
  }

  const { error } = await supabase.from("work_tickets").delete().eq("id", parsed.data);
  if (error) return { ok: false, message: notice("failDelete", { detail: error.message }) };

  revalidate();
  return { ok: true, message: notice("ticketDeleted") };
}

/** Done tickets from previous UTC months become archives. Safe to call on every tickets page load. */
export async function archiveStaleDoneTickets(): Promise<void> {
  if (!(await authorizeModule("tickets", "read"))) return;

  const supabase = createAdminSupabase();
  const cutoff = utcMonthStartIso();
  const now = new Date().toISOString();

  await supabase
    .from("work_tickets")
    .update({ status: "archived", archived_at: now })
    .eq("status", "done")
    .lt("completed_at", cutoff);

  await supabase
    .from("work_tickets")
    .update({ status: "archived", archived_at: now })
    .eq("status", "done")
    .is("completed_at", null)
    .lt("updated_at", cutoff);
}
