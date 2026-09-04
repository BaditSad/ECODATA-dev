import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import {
  fetchPlatformAssignees,
  type AssigneeOption,
} from "@/lib/data/assignees";
import type { HotelIncidentRow } from "@/types/database";

export type { AssigneeOption };
export type TenantOption = { id: string; name: string; slug: string };

export interface IncidentListItem extends HotelIncidentRow {
  tenant_name: string;
  tenant_slug: string;
  assignee_name: string | null;
  assignee_email: string | null;
}

function embedTenant(
  tenants: { name: string; slug: string } | { name: string; slug: string }[] | null
): { name: string; slug: string } {
  if (!tenants) return { name: "-", slug: "-" };
  const row = Array.isArray(tenants) ? tenants[0] : tenants;
  return { name: row?.name ?? "-", slug: row?.slug ?? "-" };
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
  row: HotelIncidentRow & {
    tenants?: { name: string; slug: string } | { name: string; slug: string }[] | null;
    profiles?:
      | { email: string; full_name: string | null }
      | { email: string; full_name: string | null }[]
      | null;
  }
): IncidentListItem {
  const { tenants, profiles, ...incident } = row;
  const tenant = embedTenant(tenants ?? null);
  const assignee = embedProfile(profiles ?? null);
  return {
    ...incident,
    tenant_name: tenant.name,
    tenant_slug: tenant.slug,
    assignee_name: assignee.name,
    assignee_email: assignee.email,
  };
}

export async function fetchTenantOptions(): Promise<TenantOption[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw new Error(`Tenant list failed: ${error.message}`);
  return data ?? [];
}

export async function fetchIncidents(): Promise<IncidentListItem[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("hotel_incidents")
    .select(
      "*, tenants(name, slug), profiles!hotel_incidents_assigned_to_fkey(email, full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(800);

  if (error) throw new Error(`Incident list failed: ${error.message}`);
  return (data ?? []).map((row) => toListItem(row as never));
}

export async function fetchIncident(
  incidentId: string
): Promise<IncidentListItem | null> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("hotel_incidents")
    .select(
      "*, tenants(name, slug), profiles!hotel_incidents_assigned_to_fkey(email, full_name)"
    )
    .eq("id", incidentId)
    .maybeSingle();

  if (error) throw new Error(`Incident lookup failed: ${error.message}`);
  if (!data) return null;
  return toListItem(data as never);
}

export async function fetchIncidentsForTenant(
  tenantId: string
): Promise<IncidentListItem[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("hotel_incidents")
    .select("*, tenants(name, slug)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Hotel incident list failed: ${error.message}`);
  return (data ?? []).map((row) => toListItem(row as never));
}

export async function fetchIncidentAssignees(): Promise<AssigneeOption[]> {
  return fetchPlatformAssignees();
}
