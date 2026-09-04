import { ipInAnyCidr } from "@/lib/auth/cidr";
import { serverEnv } from "@/lib/env";

/**
 * Stateless guest & lobby sessions.
 *
 * Guests and hall displays have no `auth.users` row — a 4-digit PIN and a
 * kiosk code are not identities Supabase Auth can model. So once a code is
 * verified we mint our own token: a JSON payload plus an HMAC-SHA256 tag,
 * stored in an httpOnly cookie.
 *
 * Stateless is the right trade here. The alternative, a server-side session
 * table, would add a database round trip to every frame the lobby kiosk renders
 * for no security gain: the payload carries no secret, only a tenant id that
 * the holder already proved they could reach.
 *
 * Web Crypto throughout, so this runs unchanged in middleware on the Edge.
 */

export type AccessTier = "guest" | "lobby";

export type SessionSource = "wifi" | "remote";

export interface SessionPayload {
  tier: AccessTier;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /**
   * How this session was minted. Absent on cookies issued before on-network
   * access existed — those are treated as remote and rejected if overlong.
   */
  source?: SessionSource;
  /**
   * Snapshot of the resort prefixes at mint time. Used to drop a wifi session
   * the moment the device leaves the hotel network, without a database round
   * trip on the Edge.
   */
  networkCidrs?: string[];
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

export const GUEST_COOKIE = "edl_guest_session";
export const LOBBY_COOKIE = "edl_lobby_session";

export function cookieNameFor(tier: AccessTier): string {
  return tier === "guest" ? GUEST_COOKIE : LOBBY_COOKIE;
}

/**
 * Absolute ceiling for a wifi-sourced cookie. The hotel's registered prefixes
 * are the real control: while the device stays on them the cookie is renewed;
 * the cap only bounds a single cookie so a stolen laptop is not signed in for
 * weeks. Default per-tenant window is 12 hours.
 */
export const WIFI_SESSION_MAX_SECONDS = 60 * 60 * 24;

/**
 * Absolute ceiling for PIN, lobby-code and remote-pass sessions. The hotel
 * sets a shorter window (default 4 hours). These are never auto-renewed.
 */
export const REMOTE_SESSION_MAX_SECONDS = 60 * 60 * 12;

/** @deprecated Use WIFI_SESSION_MAX_SECONDS / REMOTE_SESSION_MAX_SECONDS. */
export const GUEST_SESSION_MAX_SECONDS = REMOTE_SESSION_MAX_SECONDS;
/** @deprecated Lobby pairing off-network now uses REMOTE_SESSION_MAX_SECONDS. */
export const LOBBY_SESSION_MAX_SECONDS = WIFI_SESSION_MAX_SECONDS;

/* ── base64url (Edge-safe, no Buffer) ────────────────────────────────────── */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ── Signing ─────────────────────────────────────────────────────────────── */

let keyPromise: Promise<CryptoKey> | null = null;

function signingKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const { GUEST_SESSION_SECRET } = serverEnv();
    keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(GUEST_SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }
  return keyPromise;
}

/**
 * Length-independent, content-constant-time comparison.
 *
 * `crypto.subtle.verify` would also do, but this keeps the compare explicit
 * and lets us reject a length mismatch without leaking where it diverged.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
}

export interface MintOptions {
  tier: AccessTier;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  source: SessionSource;
  /** Required when `source` is `wifi`; ignored otherwise. */
  networkCidrs?: string[];
  /**
   * Requested lifetime in seconds, typically the tenant's on-network or
   * remote window. Clamped to the source cap.
   */
  maxAgeSeconds: number;
  /**
   * Hard ceiling from the credential itself — a guest code's `valid_until`.
   * The session expires at whichever comes first, this or the source cap.
   */
  notAfter?: Date | null;
  now?: Date;
}

export interface MintedSession {
  token: string;
  payload: SessionPayload;
  /** Cookie `Max-Age`, seconds. Always >= 1. */
  maxAge: number;
}

export async function mintSession(options: MintOptions): Promise<MintedSession> {
  const now = options.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);

  const sourceCap =
    options.source === "wifi"
      ? WIFI_SESSION_MAX_SECONDS
      : REMOTE_SESSION_MAX_SECONDS;

  const requested = Math.max(60, Math.floor(options.maxAgeSeconds));
  let expiry = issuedAt + Math.min(requested, sourceCap);

  if (options.notAfter) {
    const credentialExpiry = Math.floor(options.notAfter.getTime() / 1000);
    expiry = Math.min(expiry, credentialExpiry);
  }

  if (expiry <= issuedAt) {
    throw new Error(
      "Cannot mint a session that expires at or before it is issued; the underlying access code is already expired."
    );
  }

  const payload: SessionPayload = {
    tier: options.tier,
    tenantId: options.tenantId,
    tenantSlug: options.tenantSlug,
    tenantName: options.tenantName,
    source: options.source,
    networkCidrs:
      options.source === "wifi" ? [...(options.networkCidrs ?? [])] : undefined,
    iat: issuedAt,
    exp: expiry,
  };

  const body = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    new TextEncoder().encode(body)
  );

  return {
    token: `${body}.${bytesToBase64Url(new Uint8Array(signature))}`,
    payload,
    maxAge: expiry - issuedAt,
  };
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const sourceOk =
    candidate.source === undefined ||
    candidate.source === "wifi" ||
    candidate.source === "remote";
  const cidrsOk =
    candidate.networkCidrs === undefined ||
    (Array.isArray(candidate.networkCidrs) &&
      candidate.networkCidrs.every((entry) => typeof entry === "string"));
  return (
    (candidate.tier === "guest" || candidate.tier === "lobby") &&
    typeof candidate.tenantId === "string" &&
    candidate.tenantId.length > 0 &&
    typeof candidate.tenantSlug === "string" &&
    typeof candidate.tenantName === "string" &&
    typeof candidate.iat === "number" &&
    typeof candidate.exp === "number" &&
    sourceOk &&
    cidrsOk
  );
}

/**
 * Verify a token and return its payload, or null.
 *
 * Null covers every failure mode — malformed, bad signature, expired, wrong
 * tier — deliberately. Callers redirect to the code entry screen in all of
 * them, and distinguishing the cases would only feed an attacker.
 */
export async function verifySession(
  token: string | undefined | null,
  expectedTier?: AccessTier,
  now: Date = new Date()
): Promise<SessionPayload | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: ArrayBuffer;
  try {
    expected = await crypto.subtle.sign(
      "HMAC",
      await signingKey(),
      new TextEncoder().encode(body)
    );
  } catch {
    return null;
  }

  let provided: Uint8Array;
  try {
    provided = base64UrlToBytes(signature);
  } catch {
    return null;
  }

  if (!timingSafeEqual(new Uint8Array(expected), provided)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)));
  } catch {
    return null;
  }

  if (!isSessionPayload(parsed)) return null;
  if (parsed.exp * 1000 <= now.getTime()) return null;
  if (expectedTier && parsed.tier !== expectedTier) return null;

  // Cookies minted before on-network access had no `source` and a year-long
  // lobby cap. Treat them as expired so a kiosk re-admits via Wi-Fi (or a
  // short remote pass) instead of remaining signed in indefinitely.
  if (!parsed.source && parsed.exp - parsed.iat > REMOTE_SESSION_MAX_SECONDS) {
    return null;
  }

  return parsed;
}

/** Cookie attributes shared by both tiers. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" rather than "strict": a guest often arrives from a QR code or the
    // resort's own site, and "strict" would drop the cookie on that first
    // cross-site navigation and bounce them back to the PIN pad.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * A wifi session is only valid while the device is still on a prefix captured
 * at mint time. Remote sessions are bound by expiry alone.
 */
export function sessionAllowedFromIp(
  payload: SessionPayload,
  ip: string | null
): boolean {
  const source = payload.source ?? "remote";
  if (source !== "wifi") return true;
  if (!ip) return false;
  return ipInAnyCidr(ip, payload.networkCidrs);
}

/** Refresh a wifi cookie before it lapses so a hall screen does not drop overnight. */
export function wifiSessionShouldRefresh(
  payload: SessionPayload,
  now: Date = new Date()
): boolean {
  if ((payload.source ?? "remote") !== "wifi") return false;
  const ttl = payload.exp - payload.iat;
  if (ttl <= 0) return false;
  const remaining = payload.exp - Math.floor(now.getTime() / 1000);
  return remaining < Math.min(30 * 60, Math.floor(ttl * 0.35));
}
