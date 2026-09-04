import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { admitFromWifi, redeemRemotePass } from "@/lib/auth/network";
import { requestClientIp } from "@/lib/auth/client-ip";
import {
  cookieNameFor,
  sessionCookieOptions,
  type AccessTier,
} from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/api/responses";

/**
 * On-network admit and remote-pass exchange.
 *
 * Called by the guest and lobby entry screens before they show a code pad:
 * if the device is on a uniquely claimed hotel prefix, or a valid pass is in
 * the URL, a session cookie is set and the pad is skipped.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    tier: z.enum(["guest", "lobby"]),
    pass: z.string().min(1).max(80).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_payload", "Request body must be JSON.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_payload", "A 'tier' field is required.", 422);
  }

  const tier: AccessTier = parsed.data.tier;

  try {
    if (parsed.data.pass) {
      const redeemed = await redeemRemotePass({
        token: parsed.data.pass,
        tier,
      });
      if (!redeemed) {
        return apiError(
          "invalid_remote_pass",
          "That remote link is not valid. Ask reception for a new one.",
          401
        );
      }
      return sessionResponse(tier, redeemed.session);
    }

    const admitted = await admitFromWifi({
      ip: requestClientIp(request),
      tier,
    });
    if (!admitted) {
      return apiError(
        "not_on_network",
        "This device is not on the resort network.",
        404
      );
    }
    return sessionResponse(tier, admitted.session);
  } catch {
    return apiError(
      "internal_error",
      "Network admission is unavailable. Try again shortly.",
      503
    );
  }
}

function sessionResponse(
  tier: AccessTier,
  session: { token: string; payload: { tenantSlug: string; tenantName: string; exp: number; source?: string }; maxAge: number }
): NextResponse {
  const response = apiSuccess(
    {
      tier,
      source: session.payload.source ?? "remote",
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
  return response;
}
