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

export interface SessionPayload {
  tier: AccessTier;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

export const GUEST_COOKIE = "bt_guest_session";
export const LOBBY_COOKIE = "bt_lobby_session";

export function cookieNameFor(tier: AccessTier): string {
  return tier === "guest" ? GUEST_COOKIE : LOBBY_COOKIE;
}

/**
 * A guest session never outlives the code that opened it, and is capped
 * independently so a code issued with a long tail cannot mint a session that
 * outlives the stay it was meant to cover.
 */
export const GUEST_SESSION_MAX_SECONDS = 60 * 60 * 24 * 14;

/**
 * Lobby displays are wall-mounted and unattended: an operator pairs one once
 * and must not be asked to retype a code because a cookie lapsed overnight.
 * Rotating the tenant's lobby code is what revokes these.
 */
export const LOBBY_SESSION_MAX_SECONDS = 60 * 60 * 24 * 365;

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
  /**
   * Hard ceiling from the credential itself — a guest code's `valid_until`.
   * The session expires at whichever comes first, this or the tier cap.
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

  const tierCap =
    options.tier === "guest"
      ? GUEST_SESSION_MAX_SECONDS
      : LOBBY_SESSION_MAX_SECONDS;

  let expiry = issuedAt + tierCap;

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
  return (
    (candidate.tier === "guest" || candidate.tier === "lobby") &&
    typeof candidate.tenantId === "string" &&
    candidate.tenantId.length > 0 &&
    typeof candidate.tenantSlug === "string" &&
    typeof candidate.tenantName === "string" &&
    typeof candidate.iat === "number" &&
    typeof candidate.exp === "number"
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
