import { NextResponse, type NextRequest } from "next/server";
import { fetchLatestDetections } from "@/lib/data/guest";
import { LOBBY_COOKIE, verifySession } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/api/responses";

/**
 * Live detection feed for the hall display.
 *
 * The kiosk polls this rather than holding a websocket open. A wall display
 * runs for months unattended, and a poll recovers from a dropped connection,
 * a router reboot or a suspended tab on its own, with no reconnect logic to
 * get wrong. At one request a minute the load is negligible.
 *
 * Node runtime, not Edge: this reads through the service-role data layer.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession(
    request.cookies.get(LOBBY_COOKIE)?.value,
    "lobby"
  );

  if (!session) {
    return apiError(
      "invalid_lobby_code",
      "This display is not paired. Re-pair it with the resort's lobby code.",
      401
    );
  }

  try {
    // Tenant id from the verified cookie — never from the query string.
    const detections = await fetchLatestDetections(session.tenantId, 8);

    return apiSuccess(
      {
        tenantName: session.tenantName,
        detections: detections.map((detection) => ({
          id: detection.id,
          speciesName: detection.species_name,
          latinName: detection.latin_name,
          detectedAt: detection.detected_at,
        })),
        serverTime: new Date().toISOString(),
      },
      200,
      { "Cache-Control": "no-store" }
    );
  } catch {
    return apiError(
      "internal_error",
      "Detections are temporarily unavailable.",
      503
    );
  }
}
