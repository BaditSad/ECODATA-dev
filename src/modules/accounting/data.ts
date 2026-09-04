import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import type { LedgerEntryRow } from "@/types/database";

export type TenantOption = { id: string; name: string; slug: string };

export interface LedgerListItem extends LedgerEntryRow {
  tenant_name: string | null;
}

export interface AccountingSnapshot {
  mrrCents: number;
  arrCents: number;
  issuedCents: number;
  overdueCents: number;
  collectedCents: number;
  expenseCents: number;
  entries: LedgerListItem[];
  tenants: TenantOption[];
}

function monthlyEquivalent(amountCents: number, cycle: string): number {
  if (cycle === "yearly") return Math.round(amountCents / 12);
  if (cycle === "quarterly") return Math.round(amountCents / 3);
  return amountCents;
}

export async function fetchAccountingSnapshot(): Promise<AccountingSnapshot> {
  const supabase = createReadOnlyServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;

  const [tenants, contracts, invoices, ledger] = await Promise.all([
    supabase.from("tenants").select("id, name, slug").order("name"),
    supabase
      .from("contracts")
      .select("amount_cents, billing_cycle")
      .eq("status", "active"),
    supabase
      .from("invoices")
      .select("amount_cents, tax_cents, status, due_on, paid_at, issued_on"),
    supabase
      .from("ledger_entries")
      .select("*, tenants(name)")
      .order("occurred_on", { ascending: false })
      .limit(50),
  ]);

  if (tenants.error) throw new Error(`Tenant list failed: ${tenants.error.message}`);
  if (contracts.error) throw new Error(`Contract rollup failed: ${contracts.error.message}`);
  if (invoices.error) throw new Error(`Invoice rollup failed: ${invoices.error.message}`);
  if (ledger.error) throw new Error(`Ledger failed: ${ledger.error.message}`);

  let mrrCents = 0;
  for (const row of contracts.data ?? []) {
    mrrCents += monthlyEquivalent(row.amount_cents, row.billing_cycle);
  }

  let issuedCents = 0;
  let overdueCents = 0;
  let collectedCents = 0;
  for (const row of invoices.data ?? []) {
    const total = row.amount_cents + row.tax_cents;
    if (row.status === "issued") {
      issuedCents += total;
      if (row.due_on < today) overdueCents += total;
    }
    if (
      row.status === "paid" &&
      row.paid_at &&
      row.paid_at.slice(0, 10) >= yearStart
    ) {
      collectedCents += total;
    }
  }

  let expenseCents = 0;
  const entries: LedgerListItem[] = (ledger.data ?? []).map((row) => {
    const { tenants: tenantJoin, ...entry } = row as LedgerEntryRow & {
      tenants: { name: string } | { name: string }[] | null;
    };
    const tenant = Array.isArray(tenantJoin) ? tenantJoin[0] : tenantJoin;
    if (entry.kind === "expense" && entry.occurred_on >= yearStart) {
      expenseCents += Math.abs(entry.amount_cents);
    }
    return { ...entry, tenant_name: tenant?.name ?? null };
  });

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    issuedCents,
    overdueCents,
    collectedCents,
    expenseCents,
    entries,
    tenants: tenants.data ?? [],
  };
}
