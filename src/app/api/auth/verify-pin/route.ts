import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { clientIpFrom, fingerprintRequest } from "@/lib/auth/sensor-keys";
import {
  cookieNameFor,
  mintSession,
  sessionCookieOptions,
  type AccessTier,
} from "@/lib/auth/session";
import { apiError, apiSuccess, GENERIC_CODE_REJECTION } from "@/lib/api/responses";
import { normalizeLobbyCode, normalizePin } from "@/lib/pin-engine";

/**
 * Guest & lobby code verification.
 *
 * Exchanges a credential for a tenant-scoped session cookie:
 *   • a rotating 4-digit PIN  → `/client`, the guest experience
 *   • a permanent lobby code  → `/lobby`, the hall display kiosk
 *
 * ── Threat model ────────────────────────────────────────────────────────────
 * A 4-digit PIN is a 10 000-value keyspace, so online guessing is the whole
 * risk. Three things blunt it:
 *   1. `verify_guest_pin` budgets attempts per client fingerprint in the
 *      database, which survives serverless instances coming and going.
 *   2. Every rejection returns one identical message. Distinguishing "wrong"
 *      from "expired" would confirm which guesses were once real PINs.
 *   3. Responses are padded to a floor latency, so timing does not separate a
 *      shape rejection from a full database miss.
 *
 * Edge runtime: this is the guest's first interaction with the product, and it
 * should resolve near them.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Floor latency for every outcome.
 *
 * Without it, a malformed PIN returns in ~1 ms and a real lookup in ~40 ms,
 * which is a usable oracle for probing the keyspace.
 */
const MIN_RESPONSE_MS = 220;

const requestSchema = z
  .object({
    code: z.string().min(1).max(64),
    tier: z.enum(["guest", "lobby"]).default("guest"),
  })
  .strict();

async function settle<T>(startedAt: number, value: T): Promise<T> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }
  return value;
}

interface ResolvedTenant {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  notAfter: Date | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return settle(
      startedAt,
      apiError("invalid_payload", "Request body must be JSON.", 400)
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return settle(
      startedAt,
      apiError("invalid_payload", "A 'code' string is required.", 422)
    );
  }

  const tier: AccessTier = parsed.data.tier;
  const supabase = createAdminSupabase();

  let resolved: ResolvedTenant | null = null;

  if (tier === "guest") {
    const pin = normalizePin(parsed.data.code);
    if (!pin) {
      return settle(
        startedAt,
        apiError("invalid_pin", GENERIC_CODE_REJECTION, 401)
      );
    }

    const fingerprint = await fingerprintRequest(
      clientIpFrom(request.headers),
      request.headers.get("user-agent") ?? "unknown"
    );

    const { data, error } = await supabase.rpc("verify_guest_pin", {
      input_pin: pin,
      client_fingerprint: fingerprint,
    });

    if (error) {
      // 54000 is the throttle signal raised by the RPC once a fingerprint
      // exhausts its budget.
      if (error.code === "54000") {
        return settle(
          startedAt,
          apiError(
            "rate_limited",
            "Too many attempts. Please wait a few minutes and try again.",
            429,
            { "Retry-After": "900" }
          )
        );
      }
      return settle(
        startedAt,
        apiError("internal_error", "Verification is unavailable. Try again shortly.", 503)
      );
    }

    const match = data?.[0];
    if (match) {
      resolved = {
        tenantId: match.tenant_id,
        tenantSlug: match.tenant_slug,
        tenantName: match.tenant_name,
        notAfter: new Date(match.valid_until),
      };
    }
  } else {
    const lobbyCode = normalizeLobbyCode(parsed.data.code);
    if (!lobbyCode) {
      return settle(
        startedAt,
        apiError("invalid_lobby_code", GENERIC_CODE_REJECTION, 401)
      );
    }

    const { data, error } = await supabase.rpc("verify_lobby_code", {
      input_code: lobbyCode,
    });

    if (error) {
      return settle(
        startedAt,
        apiError("internal_error", "Verification is unavailable. Try again shortly.", 503)
      );
    }

    const match = data?.[0];
    if (match) {
      resolved = {
        tenantId: match.tenant_id,
        tenantSlug: match.tenant_slug,
        tenantName: match.tenant_name,
        // Lobby codes do not expire; only an admin rotation invalidates them.
        notAfter: null,
      };
    }
  }

  if (!resolved) {
    return settle(
      startedAt,
      apiError(
        tier === "guest" ? "invalid_pin" : "invalid_lobby_code",
        GENERIC_CODE_REJECTION,
        401
      )
    );
  }

  const session = await mintSession({
    tier,
    tenantId: resolved.tenantId,
    tenantSlug: resolved.tenantSlug,
    tenantName: resolved.tenantName,
    notAfter: resolved.notAfter,
  });

  const response = apiSuccess(
    {
      tier,
      tenantSlug: session.payload.tenantSlug,
      tenantName: session.payload.tenantName,
      expiresAt: new Date(session.payload.exp * 1000).toISOString(),
      redirectTo: tier === "guest" ? "/client" : "/lobby",
    },
    200
  );

  response.cookies.set(
    cookieNameFor(tier),
    session.token,
    sessionCookieOptions(session.maxAge)
  );

  return settle(startedAt, response);
}

/** Ends a guest or kiosk session. Used by the "leave" control in both views. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const tier: AccessTier =
    request.nextUrl.searchParams.get("tier") === "lobby" ? "lobby" : "guest";

  const response = apiSuccess({ signedOut: true, tier });
  response.cookies.set(cookieNameFor(tier), "", sessionCookieOptions(0));
  return response;
}
