import type { NextRequest } from "next/server";
import { normalizeIp } from "@/lib/auth/cidr";
import { clientIpFrom } from "@/lib/auth/sensor-keys";

/**
 * Address the platform actually sees for this request.
 *
 * On a deployed hotel this is almost always the resort's public NAT — every
 * guest on that Wi-Fi shares it. Locally it is 127.0.0.1 or a LAN address.
 */
export function requestClientIp(request: NextRequest): string | null {
  const fromHeaders = clientIpFrom(request.headers);
  const fromEdge = "ip" in request ? (request as NextRequest & { ip?: string }).ip : undefined;

  for (const candidate of [fromHeaders, fromEdge]) {
    const normalised = normalizeIp(candidate ?? null);
    if (normalised) return normalised;
  }

  if (process.env.NODE_ENV !== "production") return "127.0.0.1";
  return null;
}

export function clientIpFromHeaders(headerList: Headers): string | null {
  const normalised = normalizeIp(clientIpFrom(headerList));
  if (normalised) return normalised;
  if (process.env.NODE_ENV !== "production") return "127.0.0.1";
  return null;
}
