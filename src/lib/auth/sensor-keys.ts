import { serverEnv } from "@/lib/env";

/**
 * Sensor API credentials.
 *
 * A balise authenticates every upload with a long random key sent in
 * `X-Sensor-API-Key`. We store only `SHA-256(pepper || rawKey)`.
 *
 * ── Why a fast hash, not bcrypt/argon2 ──────────────────────────────────────
 * Password hashing is deliberately slow to survive a *low-entropy* secret
 * being brute-forced offline. These keys are 32 bytes of CSPRNG output — 256
 * bits — so there is nothing to brute-force, and a slow KDF would only add
 * latency to the hottest path in the platform. The peppered SHA-256 gives us
 * what we actually need: a constant-time, indexable lookup where a database
 * leak alone does not yield usable credentials, because the pepper lives in
 * the environment rather than the table.
 */

const KEY_BYTES = 32;

/**
 * Distinguishes an Eco-Data Link sensor key in logs and support tickets.
 *
 * Baked into every key ever issued, so changing it invalidates the entire
 * provisioned fleet. Treat as frozen once hardware ships.
 */
const KEY_PREFIX = "edlk";

export interface ProvisionedKey {
  /** Shown exactly once, at provisioning. Never recoverable afterwards. */
  rawKey: string;
  /** Stored in `sensors_balises.api_key_hash`. */
  hash: string;
  /** Stored for operator identification without reconstructing the key. */
  lastFour: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Peppered SHA-256, hex-encoded. */
export async function hashSensorApiKey(rawKey: string): Promise<string> {
  const { SENSOR_API_KEY_PEPPER } = serverEnv();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${SENSOR_API_KEY_PEPPER}:${rawKey}`)
  );
  return toHex(new Uint8Array(digest));
}

/** Mint a new credential for a balise being provisioned. */
export async function generateSensorApiKey(): Promise<ProvisionedKey> {
  const entropy = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(entropy);

  const rawKey = `${KEY_PREFIX}_${toHex(entropy)}`;

  return {
    rawKey,
    hash: await hashSensorApiKey(rawKey),
    lastFour: rawKey.slice(-4),
  };
}

/**
 * Shape check before touching the database.
 *
 * Rejecting malformed keys here means a scanner spraying the ingest endpoint
 * never causes a query, and the hot path stays cheap under load.
 */
export function looksLikeSensorApiKey(value: string): boolean {
  return new RegExp(`^${KEY_PREFIX}_[0-9a-f]{${KEY_BYTES * 2}}$`).test(value);
}

/**
 * Stable, non-reversible fingerprint of a request origin.
 *
 * Used to budget guest PIN attempts. Hashing means the throttle table holds no
 * raw IP addresses, so it is not itself a privacy liability, and the
 * environment pepper stops an attacker with table access from confirming
 * whether a given address appears in it.
 */
export async function fingerprintRequest(
  ip: string,
  userAgent: string
): Promise<string> {
  const { SENSOR_API_KEY_PEPPER } = serverEnv();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${SENSOR_API_KEY_PEPPER}|${ip}|${userAgent}`)
  );
  return toHex(new Uint8Array(digest));
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that overwrites it;
 * on Vercel and most managed edges it is. The leftmost entry is the client.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
