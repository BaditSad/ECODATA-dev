import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeModule, type ErpSession } from "@/lib/auth/erp";

/**
 * Plumbing shared by the Domains module's actions.
 *
 * No `"use server"` directive: this file exports values and types, which that
 * directive forbids. The actions themselves live in the sibling files.
 */

export const uuid = z.string().uuid();

/**
 * Authorise a write to the Domains module.
 *
 * Every action calls this. A Server Action is a public POST endpoint — being
 * *rendered* inside a guarded shell does nothing to stop a crafted request, so
 * the check has to sit in the action itself.
 */
export async function domainsWriter(): Promise<ErpSession | null> {
  return authorizeModule("domains", "write");
}

/** Refresh the two places a resort is displayed. */
export function revalidateDomain(tenantId: string): void {
  revalidatePath(`/admin/domains/${tenantId}`);
  revalidatePath("/admin/domains");
}
