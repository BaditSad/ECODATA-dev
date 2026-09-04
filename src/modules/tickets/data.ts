import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import {
  fetchPlatformAssignees,
  type AssigneeOption,
} from "@/lib/data/assignees";
import type { WorkTicketRow } from "@/types/database";

export type { AssigneeOption };

export interface WorkTicketListItem extends WorkTicketRow {
  assignee_name: string | null;
  assignee_email: string | null;
}

function embedProfile(
  profiles:
    | { email: string; full_name: string | null }
    | { email: string; full_name: string | null }[]
    | null
): { email: string | null; name: string | null } {
  if (!profiles) return { email: null, name: null };
  const row = Array.isArray(profiles) ? profiles[0] : profiles;
  return { email: row?.email ?? null, name: row?.full_name ?? null };
}

function toListItem(
  row: WorkTicketRow & {
    profiles:
      | { email: string; full_name: string | null }
      | { email: string; full_name: string | null }[]
      | null;
  }
): WorkTicketListItem {
  const { profiles, ...ticket } = row;
  const assignee = embedProfile(profiles);
  return {
    ...ticket,
    assignee_name: assignee.name,
    assignee_email: assignee.email,
  };
}

export async function fetchWorkTickets(): Promise<WorkTicketListItem[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("work_tickets")
    .select("*, profiles!work_tickets_assigned_to_fkey(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(800);

  if (error) throw new Error(`Ticket list failed: ${error.message}`);

  return (data ?? []).map((row) =>
    toListItem(
      row as WorkTicketRow & {
        profiles:
          | { email: string; full_name: string | null }
          | { email: string; full_name: string | null }[]
          | null;
      }
    )
  );
}

export async function fetchWorkTicket(
  ticketId: string
): Promise<WorkTicketListItem | null> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("work_tickets")
    .select("*, profiles!work_tickets_assigned_to_fkey(email, full_name)")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) throw new Error(`Ticket lookup failed: ${error.message}`);
  if (!data) return null;

  return toListItem(
    data as WorkTicketRow & {
      profiles:
        | { email: string; full_name: string | null }
        | { email: string; full_name: string | null }[]
        | null;
    }
  );
}

export async function fetchTicketAssignees(): Promise<AssigneeOption[]> {
  return fetchPlatformAssignees();
}
