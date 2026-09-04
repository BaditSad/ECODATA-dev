"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import { parseCidrList } from "@/lib/auth/cidr";
import { domainsWriter, revalidateDomain, uuid } from "./shared";
import { z } from "zod";

/**
 * Hotel networks that admit guest and lobby surfaces without a code.
 *
 * Written through RLS so the Domains grant is the authorisation, not the
 * service role. An empty list disables on-network admission for that resort.
 */

const schema = z.object({
  tenantId: uuid,
  cidrs: z.string(),
});

export async function updateDomainTrustedNetworks(
  formData: FormData
): Promise<ActionResult> {
  if (!(await domainsWriter())) return denied("domains");

  const parsed = schema.safeParse({
    tenantId: formData.get("tenantId"),
    cidrs: formData.get("cidrs"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidInput"),
    };
  }

  const networks = parseCidrList(parsed.data.cidrs);
  if ("error" in networks) {
    const token = networks.error.match(/^"([^"]+)"/)?.[1] ?? "";
    return { ok: false, message: notice("invalidCidr", { token }) };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("tenants")
    .update({ network_cidrs: networks.cidrs })
    .eq("id", parsed.data.tenantId);

  if (error) {
    return {
      ok: false,
      message: notice("failTrustedNetworks", { detail: error.message }),
    };
  }

  revalidateDomain(parsed.data.tenantId);
  return {
    ok: true,
    message:
      networks.cidrs.length === 0
        ? notice("onNetworkOff")
        : notice("trustedNetworksUpdated", { n: networks.cidrs.length }),
  };
}
