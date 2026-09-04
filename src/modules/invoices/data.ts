import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import type { InvoiceRow } from "@/types/database";

export interface InvoiceListItem extends InvoiceRow {
  tenant_name: string;
  tenant_slug: string;
  contract_starts_on: string | null;
  contract_ends_on: string | null;
}

function toListItem(
  row: InvoiceRow & {
    tenants?: { name: string; slug: string } | { name: string; slug: string }[] | null;
    contracts?: { starts_on: string; ends_on: string } | { starts_on: string; ends_on: string }[] | null;
  }
): InvoiceListItem {
  const { tenants, contracts, ...invoice } = row;
  const tenant = Array.isArray(tenants) ? tenants[0] : tenants;
  const contract = Array.isArray(contracts) ? contracts[0] : contracts;
  return {
    ...invoice,
    tenant_name: tenant?.name ?? "-",
    tenant_slug: tenant?.slug ?? "-",
    contract_starts_on: contract?.starts_on ?? null,
    contract_ends_on: contract?.ends_on ?? null,
  };
}

export async function fetchInvoicesForTenant(
  tenantId: string
): Promise<InvoiceListItem[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, tenants(name, slug), contracts(starts_on, ends_on)")
    .eq("tenant_id", tenantId)
    .order("issued_on", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Invoice list failed: ${error.message}`);
  return (data ?? []).map((row) => toListItem(row as never));
}
