import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import type { ContractRow } from "@/types/database";

export interface ContractListItem extends ContractRow {
  tenant_name: string;
  tenant_slug: string;
}

function toListItem(
  row: ContractRow & {
    tenants: { name: string; slug: string } | { name: string; slug: string }[] | null;
  }
): ContractListItem {
  const { tenants, ...contract } = row;
  const tenant = Array.isArray(tenants) ? tenants[0] : tenants;
  return {
    ...contract,
    tenant_name: tenant?.name ?? "-",
    tenant_slug: tenant?.slug ?? "-",
  };
}

export async function fetchContractsForTenant(
  tenantId: string
): Promise<ContractListItem[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, tenants(name, slug)")
    .eq("tenant_id", tenantId)
    .order("ends_on", { ascending: false });

  if (error) throw new Error(`Contract list failed: ${error.message}`);
  return (data ?? []).map((row) => toListItem(row as never));
}
