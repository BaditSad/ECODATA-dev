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
  return authorizeModule("contracts", "write");
}

function revalidate(tenantId?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/domains");
  if (tenantId) revalidatePath(`/admin/domains/${tenantId}`);
}

function upsertSchema() {
  return z.object({
    tenantId: uuid,
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, notice("dateRequired")),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, notice("dateRequired")),
    billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
    amountCents: z.number().int().min(0),
    notes: z.string().trim().max(2000).optional(),
  });
}

/**
 * Open a contract for a resort.
 *
 * An existing active contract on that resort is ended first: two current
 * terms would make MRR and the renewal date unreadable. Drafts stay drafts
 * until someone sets them active from the list.
 */
export async function createContract(
  formData: FormData
): Promise<ActionResult> {
  const session = await writer();
  if (!session) return denied("contracts");

  const amountCents = parseEurosToCents(formData.get("amount"));
  if (amountCents === null) {
    return { ok: false, message: notice("validEuros") };
  }

  const parsed = upsertSchema().safeParse({
    tenantId: formData.get("tenantId"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    billingCycle: formData.get("billingCycle") || "yearly",
    amountCents,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidContract"),
    };
  }

  const input = parsed.data;
  if (input.endsOn <= input.startsOn) {
    return { ok: false, message: notice("endAfterStart") };
  }

  const supabase = createAdminSupabase();

  const { error: endError } = await supabase
    .from("contracts")
    .update({ status: "ended" })
    .eq("tenant_id", input.tenantId)
    .eq("status", "active");

  if (endError) {
    return { ok: false, message: notice("failCloseTerm", { detail: endError.message }) };
  }

  const { error } = await supabase.from("contracts").insert({
    tenant_id: input.tenantId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    billing_cycle: input.billingCycle,
    amount_cents: input.amountCents,
    notes: input.notes ?? null,
    status: "active",
    created_by: session.userId,
  });

  if (error) return { ok: false, message: notice("failSaveContract", { detail: error.message }) };

  await supabase
    .from("tenants")
    .update({
      subscription_status: "active",
      subscription_renews_at: `${input.endsOn}T00:00:00Z`,
    })
    .eq("id", input.tenantId);

  revalidate(input.tenantId);
  return { ok: true, message: notice("contractLive") };
}

export async function cancelContract(contractId: string): Promise<ActionResult> {
  if (!(await writer())) return denied("contracts");
  if (!uuid.safeParse(contractId).success) {
    return { ok: false, message: notice("invalidContract") };
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "cancelled" })
    .eq("id", contractId)
    .neq("status", "cancelled")
    .select("tenant_id")
    .maybeSingle();

  if (error) return { ok: false, message: notice("failCancel", { detail: error.message }) };

  revalidate(data?.tenant_id);
  return { ok: true, message: notice("contractCancelled") };
}
