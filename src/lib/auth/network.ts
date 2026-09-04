import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { parseCidr } from "@/lib/auth/cidr";
import {
  mintSession,
  type AccessTier,
  type MintedSession,
  type SessionSource,
} from "@/lib/auth/session";
import type { TenantRow } from "@/types/database";

/**
 * Resolve on-network and remote-pass access for guest and lobby surfaces.
 *
 * Service-role only: guests have no auth.users row, and the lookup must see
 * every tenant's prefixes to detect an ambiguous (shared) CIDR.
 */

const REMOTE_PASS_PREFIX = "edlp";

export type NetworkTenant = Pick<
  TenantRow,
  | "id"
  | "slug"
  | "name"
  | "network_cidrs"
  | "on_network_hours"
  | "remote_session_hours"
  | "is_active"
>;

export interface AdmitResult {
  session: MintedSession;
  source: SessionSource;
}

function hoursToSeconds(hours: number): number {
  return Math.max(1, hours) * 60 * 60;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashRemotePassToken(raw: string): Promise<string> {
  const { GUEST_SESSION_SECRET } = serverEnv();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${GUEST_SESSION_SECRET}:remote-pass:${raw}`)
  );
  return toHex(new Uint8Array(digest));
}

export async function generateRemotePassToken(): Promise<{
  raw: string;
  hash: string;
}> {
  const entropy = new Uint8Array(16);
  crypto.getRandomValues(entropy);
  const raw = `${REMOTE_PASS_PREFIX}_${toHex(entropy)}`;
  return { raw, hash: await hashRemotePassToken(raw) };
}

export function looksLikeRemotePassToken(value: string): boolean {
  return new RegExp(`^${REMOTE_PASS_PREFIX}_[0-9a-f]{32}$`).test(value.trim().toLowerCase());
}

export function canonicalCidr(value: string): string | null {
  return parseCidr(value)?.canonical ?? null;
}

/**
 * Unique tenant whose registered prefixes contain this IP.
 *
 * Zero matches: not on a claimed network.
 * Two or more: prefixes overlap (typical on a shared 192.168.x lab) — refuse
 * auto-admit rather than guess the hotel. The RPC returns at most two rows
 * for that check.
 */
export async function resolveUniqueOnNetworkTenant(
  ip: string | null
): Promise<NetworkTenant | null> {
  if (!ip) return null;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("match_tenant_by_ip", {
    client_ip: ip,
  });

  if (error) {
    throw new Error(`On-network tenant lookup failed: ${error.message}`);
  }

  if (!data || data.length !== 1) return null;
  const match = data[0];
  if (!match) return null;

  return {
    id: match.tenant_id,
    slug: match.tenant_slug,
    name: match.tenant_name,
    network_cidrs: match.network_cidrs,
    on_network_hours: match.on_network_hours,
    remote_session_hours: match.remote_session_hours,
    is_active: true,
  };
}

export async function loadTenantForAccess(
  tenantId: string
): Promise<NetworkTenant | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select(
      "id, slug, name, network_cidrs, on_network_hours, remote_session_hours, is_active"
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Tenant access lookup failed: ${error.message}`);
  }
  if (!data || !data.is_active) return null;
  return data;
}

export async function mintAccessSession(options: {
  tenant: NetworkTenant;
  tier: AccessTier;
  source: SessionSource;
  notAfter?: Date | null;
}): Promise<MintedSession> {
  const hours =
    options.source === "wifi"
      ? options.tenant.on_network_hours
      : options.tenant.remote_session_hours;

  return mintSession({
    tier: options.tier,
    tenantId: options.tenant.id,
    tenantSlug: options.tenant.slug,
    tenantName: options.tenant.name,
    source: options.source,
    networkCidrs: options.tenant.network_cidrs,
    maxAgeSeconds: hoursToSeconds(hours),
    notAfter: options.notAfter,
  });
}

export async function admitFromWifi(options: {
  ip: string | null;
  tier: AccessTier;
}): Promise<AdmitResult | null> {
  const tenant = await resolveUniqueOnNetworkTenant(options.ip);
  if (!tenant) return null;
  const session = await mintAccessSession({
    tenant,
    tier: options.tier,
    source: "wifi",
  });
  return { session, source: "wifi" };
}

export async function redeemRemotePass(options: {
  token: string;
  tier: AccessTier;
}): Promise<AdmitResult | null> {
  if (!looksLikeRemotePassToken(options.token)) return null;

  const hash = await hashRemotePassToken(options.token.trim().toLowerCase());
  const supabase = createAdminSupabase();
  const nowIso = new Date().toISOString();

  const { data: pass, error } = await supabase
    .from("remote_access_passes")
    .select("*")
    .eq("token_hash", hash)
    .eq("tier", options.tier)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error) {
    throw new Error(`Remote pass lookup failed: ${error.message}`);
  }
  if (!pass) return null;

  const tenant = await loadTenantForAccess(pass.tenant_id);
  if (!tenant) return null;

  const { error: touchError } = await supabase
    .from("remote_access_passes")
    .update({ last_used_at: nowIso })
    .eq("id", pass.id);

  if (touchError) {
    throw new Error(`Remote pass touch failed: ${touchError.message}`);
  }

  const session = await mintAccessSession({
    tenant,
    tier: options.tier,
    source: "remote",
    notAfter: new Date(pass.expires_at),
  });

  return { session, source: "remote" };
}
