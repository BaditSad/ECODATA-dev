/**
 * Which console an origin serves.
 *
 * One build, two audiences. The platform console is where the operator
 * onboards resorts and oversees the whole estate; the resort surfaces are the
 * guest twin, the staff portal and the hall display. They share a schema, a
 * data layer and an auth stack, so they stay one codebase — but they are never
 * reachable from the same origin. A guest who guesses `/admin` must not even
 * find a sign-in form there.
 *
 * Resolution is by origin rather than by a per-process env var so both dev
 * servers are launched identically and differ only in the port they bind.
 */

export type Surface = "admin" | "tenant";

/** Port the platform console binds to. */
export const ADMIN_PORT = process.env.ADMIN_PORT?.trim() || "3002";

/** Hostnames serving the platform console once deployed behind a proxy. */
const ADMIN_HOSTNAMES = (process.env.ADMIN_HOSTNAMES ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

/** Split a Host header, tolerating bracketed IPv6 literals such as `[::1]:3002`. */
function splitHost(host: string): { hostname: string; port: string | null } {
  const normalized = host.trim().toLowerCase();
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(normalized);
  if (!match?.[1]) return { hostname: normalized, port: null };
  return { hostname: match[1], port: match[2] ?? null };
}

/**
 * Unknown origins resolve to `tenant`, so a misconfigured proxy exposes the
 * resort surfaces rather than the platform console.
 */
export function surfaceForHost(host: string | null | undefined): Surface {
  if (!host) return "tenant";

  const { hostname, port } = splitHost(host);
  if (ADMIN_HOSTNAMES.includes(hostname)) return "admin";
  return port === ADMIN_PORT ? "admin" : "tenant";
}

/** True for paths that belong to the platform console. */
export function isPlatformPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Where the platform console lives, seen from the caller's own origin.
 *
 * Used to point an operator who signed in on a resort console at the right
 * one instead of leaving them on a page that will never load for them.
 */
export function adminOrigin(
  host: string | null | undefined,
  protocol = "http"
): string | null {
  if (ADMIN_HOSTNAMES.length > 0) return `https://${ADMIN_HOSTNAMES[0]}`;
  if (!host) return null;
  return `${protocol}://${splitHost(host).hostname}:${ADMIN_PORT}`;
}
