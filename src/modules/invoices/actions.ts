"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { authorizeModule } from "@/lib/auth/erp";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import { parseEurosToCents } from "@/lib/format";

const uuid = z.string().uuid();

async function writer() {
  return authorizeModule("invoices", "write");
}

function revalidate(tenantId?: string): void {
  revalidatePath("/admin/accounting");
  revalidatePath("/admin");
  revalidatePath("/admin/domains");
  if (tenantId) revalidatePath(`/admin/domains/${tenantId}`);
}

async function nextNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("invoices")
    .select("number")
    .like("number", `${prefix}%`)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = data?.number?.slice(prefix.length) ?? "0000";
  const next = Number.parseInt(last, 10) + 1;
  return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(4, "0")}`;
}

export async function issueInvoice(formData: FormData): Promise<ActionResult> {
  const session = await writer();
  if (!session) return denied("invoices");

  const amountCents = parseEurosToCents(formData.get("amount"));
  const taxCents = parseEurosToCents(formData.get("tax") || "0") ?? 0;
  if (amountCents === null) {
    return { ok: false, message: notice("validEuros") };
  }

  const contractId = String(formData.get("contractId") ?? "");
  const dueOn = String(formData.get("dueOn") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!uuid.safeParse(contractId).success) {
    return { ok: false, message: notice("chooseContract") };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) {
    return { ok: false, message: notice("dueDateRequired") };
  }

  const supabase = createAdminSupabase();
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, tenant_id")
    .eq("id", contractId)
    .maybeSingle();

  if (contractError || !contract) {
    return { ok: false, message: notice("contractUnavailable") };
  }

  const number = await nextNumber();
  const issuedOn = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("invoices").insert({
    tenant_id: contract.tenant_id,
    contract_id: contract.id,
    number,
    issued_on: issuedOn,
    due_on: dueOn < issuedOn ? issuedOn : dueOn,
    amount_cents: amountCents,
    tax_cents: taxCents,
    notes,
    status: "issued",
    created_by: session.userId,
  });

  if (error) return { ok: false, message: notice("failIssue", { detail: error.message }) };

  revalidate(contract.tenant_id);
  return { ok: true, message: notice("invoiceIssued", { number }) };
}

export async function markInvoicePaid(invoiceId: string): Promise<ActionResult> {
  if (!(await writer())) return denied("invoices");
  if (!uuid.safeParse(invoiceId).success) {
    return { ok: false, message: notice("invalidInvoice") };
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", "issued")
    .select("tenant_id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: notice("failRecordPayment", { detail: error.message }) };
  }

  revalidate(data?.tenant_id);
  return { ok: true, message: notice("markedPaid") };
}

export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  if (!(await writer())) return denied("invoices");
  if (!uuid.safeParse(invoiceId).success) {
    return { ok: false, message: notice("invalidInvoice") };
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void", paid_at: null })
    .eq("id", invoiceId)
    .neq("status", "paid")
    .select("tenant_id")
    .maybeSingle();

  if (error) return { ok: false, message: notice("failVoid", { detail: error.message }) };

  revalidate(data?.tenant_id);
  return { ok: true, message: notice("invoiceVoided") };
}
