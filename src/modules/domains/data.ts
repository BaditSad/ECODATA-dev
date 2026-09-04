import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import type {
  Map3dAssetRow,
  SensorBaliseRow,
  TenantAccessCodeRow,
  TenantDetectionRollupRow,
  TenantFleetOverviewRow,
  TenantRow,
} from "@/types/database";

/**
 * Domains module — reads.
 *
 * Deliberately uses the RLS-scoped server client rather than the service role.
 * The `domains` grant is enforced by policy, so going through it means the
 * authorisation matrix is exercised on every request instead of being bypassed
 * and left to rot untested.
 */

export interface DomainRow extends TenantFleetOverviewRow {
  detections: TenantDetectionRollupRow | null;
}

export async function fetchDomains(): Promise<DomainRow[]> {
  const supabase = createReadOnlyServerSupabase();

  const [fleet, rollup] = await Promise.all([
    supabase
      .from("tenant_fleet_overview")
      .select("*")
      .order("tenant_name", { ascending: true }),
    supabase.from("tenant_detection_rollup").select("*"),
  ]);

  if (fleet.error) throw new Error(`Fleet overview failed: ${fleet.error.message}`);
  if (rollup.error) throw new Error(`Detection rollup failed: ${rollup.error.message}`);

  const byTenant = new Map<string, TenantDetectionRollupRow>(
    (rollup.data ?? []).map((row) => [row.tenant_id, row])
  );

  return (fleet.data ?? []).map((row) => ({
    ...row,
    detections: byTenant.get(row.tenant_id) ?? null,
  }));
}

export async function fetchDomainDirectory(): Promise<
  Pick<DomainRow, "tenant_id" | "tenant_name" | "tenant_slug" | "subscription_status">[]
> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, subscription_status")
    .order("name", { ascending: true });

  if (error) throw new Error(`Domain directory failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    tenant_id: row.id,
    tenant_name: row.name,
    tenant_slug: row.slug,
    subscription_status: row.subscription_status,
  }));
}

export async function fetchDomain(tenantId: string): Promise<TenantRow | null> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`Tenant lookup failed: ${error.message}`);
  return data;
}

export async function fetchDomainSensors(
  tenantId: string
): Promise<SensorBaliseRow[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("sensors_balises")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Sensor list failed: ${error.message}`);
  return data ?? [];
}

export async function fetchDomainAccessCodes(
  tenantId: string
): Promise<TenantAccessCodeRow[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("tenant_access_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("cycle_index", { ascending: false })
    .limit(12);

  if (error) throw new Error(`Access code list failed: ${error.message}`);
  return data ?? [];
}

export async function fetchDomainAssets(
  tenantId: string
): Promise<Map3dAssetRow[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("map_3d_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Asset list failed: ${error.message}`);
  return data ?? [];
}
