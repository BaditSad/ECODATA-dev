"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { authorizeModule } from "@/lib/auth/erp";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import { parseEurosToCents } from "@/lib/format";

async function writer() {
  return authorizeModule("accounting", "write");
}

export async function recordLedgerEntry(
  formData: FormData
): Promise<ActionResult> {
  const session = await writer();
  if (!session) return denied("accounting");

  const amountCents = parseEurosToCents(formData.get("amount"));
  if (amountCents === null || amountCents === 0) {
    return { ok: false, message: notice("nonzeroEuros") };
  }

  const kind = z.enum(["expense", "adjustment"]).safeParse(formData.get("kind"));
  const memo = z
    .string()
    .trim()
    .min(3, notice("memoRequired"))
    .max(500)
    .safeParse(formData.get("memo"));
  const occurredOn = String(formData.get("occurredOn") ?? "");
  const tenantRaw = String(formData.get("tenantId") ?? "").trim();

  if (!kind.success) return { ok: false, message: notice("chooseExpenseOrAdjustment") };
  if (!memo.success) {
    return { ok: false, message: memo.error.issues[0]?.message ?? notice("invalidMemo") };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return { ok: false, message: notice("dateRequired") };
  }

  const signed =
    kind.data === "expense" ? -Math.abs(amountCents) : amountCents;

  const supabase = createAdminSupabase();
  const { error } = await supabase.from("ledger_entries").insert({
    tenant_id: z.string().uuid().safeParse(tenantRaw).success ? tenantRaw : null,
    occurred_on: occurredOn,
    kind: kind.data,
    amount_cents: signed,
    memo: memo.data,
    created_by: session.userId,
  });

  if (error) return { ok: false, message: notice("failPost", { detail: error.message }) };

  revalidatePath("/admin/accounting");
  revalidatePath("/admin");
  return { ok: true, message: notice("entryPosted") };
}
