import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { requestClientIp } from "@/lib/auth/client-ip";
import {
  GUEST_COOKIE,
  LOBBY_COOKIE,
  cookieNameFor,
  mintSession,
  sessionAllowedFromIp,
  sessionCookieOptions,
  verifySession,
  wifiSessionShouldRefresh,
  type AccessTier,
  type SessionPayload,
} from "@/lib/auth/session";
import { isPlatformPath, surfaceForHost } from "@/lib/surface";
import { isPlatformRole } from "@/lib/auth/roles";

/**
 * Edge guard for all four access tiers.
 *
 * Middleware is the outer perimeter, not the only one. It refuses obviously
 * unauthorized requests before a Server Component renders, but each route
 * group re-checks in its own layout: middleware alone would leave a data
 * access path unprotected the moment someone adds a route it does not match.
 * Defence in depth, cheap in both places.
 */

const SIGN_IN = "/sign-in";
const PIN_ENTRY = "/client/login";
const LOBBY_ENTRY = "/lobby/pair";

function redirect(request: NextRequest, pathname: string, from?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (from) url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

function clearTierCookie(response: NextResponse, tier: AccessTier) {
  response.cookies.set(cookieNameFor(tier), "", sessionCookieOptions(0));
  return response;
}

async function liveSession(
  request: NextRequest,
  cookieValue: string | undefined,
  tier: AccessTier
): Promise<{ payload: SessionPayload | null; refresh: SessionPayload | null }> {
  const payload = await verifySession(cookieValue, tier);
  if (!payload) return { payload: null, refresh: null };

  const ip = requestClientIp(request);
  if (!sessionAllowedFromIp(payload, ip)) {
    return { payload: null, refresh: null };
  }

  if (wifiSessionShouldRefresh(payload)) {
    return { payload, refresh: payload };
  }

  return { payload, refresh: null };
}

async function withWifiRefresh(
  response: NextResponse,
  payload: SessionPayload,
  tier: AccessTier
): Promise<NextResponse> {
  const reminted = await mintSession({
    tier,
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    tenantName: payload.tenantName,
    source: "wifi",
    networkCidrs: payload.networkCidrs,
    maxAgeSeconds: payload.exp - payload.iat,
  });
  response.cookies.set(
    cookieNameFor(tier),
    reminted.token,
    sessionCookieOptions(reminted.maxAge)
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const surface = surfaceForHost(request.headers.get("host"));

  // ── Origin split: platform console vs resort surfaces ─────────────────────
  // Each origin serves only its own console. Bouncing the other one's routes
  // here, before any session is even loaded, is what makes the separation
  // real: /admin does not exist on a resort origin, so there is nothing there
  // for a guest to find and nothing for a future route to accidentally expose.
  if (surface === "admin") {
    if (!isPlatformPath(pathname) && pathname !== SIGN_IN) {
      return redirect(request, "/admin");
    }
  } else if (isPlatformPath(pathname)) {
    return redirect(request, SIGN_IN);
  }

  // ── Guest tier: hotel Wi-Fi, remote pass, or rotating PIN ─────────────────
  if (pathname.startsWith("/client")) {
    const { payload, refresh } = await liveSession(
      request,
      request.cookies.get(GUEST_COOKIE)?.value,
      "guest"
    );

    if (pathname === PIN_ENTRY) {
      if (!payload) {
        const bounce = NextResponse.next();
        if (request.cookies.get(GUEST_COOKIE)?.value) {
          clearTierCookie(bounce, "guest");
        }
        return bounce;
      }
      const destination = redirect(request, "/client");
      return refresh ? withWifiRefresh(destination, refresh, "guest") : destination;
    }

    if (!payload) {
      const bounce = redirect(request, PIN_ENTRY, pathname);
      if (request.cookies.get(GUEST_COOKIE)?.value) {
        clearTierCookie(bounce, "guest");
      }
      return bounce;
    }

    const next = NextResponse.next();
    return refresh ? withWifiRefresh(next, refresh, "guest") : next;
  }

  // ── Lobby tier: hotel Wi-Fi, remote pass, or kiosk code ───────────────────
  if (pathname.startsWith("/lobby")) {
    const { payload, refresh } = await liveSession(
      request,
      request.cookies.get(LOBBY_COOKIE)?.value,
      "lobby"
    );

    if (pathname === LOBBY_ENTRY) {
      if (!payload) {
        const bounce = NextResponse.next();
        if (request.cookies.get(LOBBY_COOKIE)?.value) {
          clearTierCookie(bounce, "lobby");
        }
        return bounce;
      }
      const destination = redirect(request, "/lobby");
      return refresh ? withWifiRefresh(destination, refresh, "lobby") : destination;
    }

    if (!payload) {
      const bounce = redirect(request, LOBBY_ENTRY, pathname);
      if (request.cookies.get(LOBBY_COOKIE)?.value) {
        clearTierCookie(bounce, "lobby");
      }
      return bounce;
    }

    const next = NextResponse.next();
    return refresh ? withWifiRefresh(next, refresh, "lobby") : next;
  }

  // ── Staff tiers: Supabase email/password ──────────────────────────────────
  const isAdminRoute = pathname.startsWith("/admin");
  const isPortalRoute = pathname.startsWith("/hotel-portal");

  if (!isAdminRoute && !isPortalRoute && pathname !== SIGN_IN) {
    return NextResponse.next();
  }

  // Always refresh first: the rotated cookies must ride out on whatever
  // response we return, including a redirect.
  const { response, staff } = await updateSession(request);

  if (pathname === SIGN_IN) {
    if (!staff) return response;

    if (isPlatformRole(staff.role)) {
      // On a resort origin there is no destination for platform staff, and
      // sending them to /admin would bounce straight back here. The page stays
      // put instead and names the console they want.
      return surface === "admin" ? redirect(request, "/admin") : response;
    }

    return redirect(request, "/hotel-portal");
  }

  if (!staff) {
    return redirect(request, SIGN_IN, pathname);
  }

  if (isAdminRoute && !isPlatformRole(staff.role)) {
    // A resort employee who lands on /admin is sent to their own console
    // rather than shown a 403 they can do nothing about. Which ERP modules a
    // platform account may open is decided per module, not here.
    return redirect(request, "/hotel-portal");
  }

  if (isPortalRoute) {
    // Platform staff have no tenant of their own, so the portal has nothing to
    // show them; the ERP is where they belong.
    if (isPlatformRole(staff.role)) return redirect(request, "/admin");
    if (!staff.tenantId) return redirect(request, SIGN_IN);
  }

  return response;
}

export const config = {
  /**
   * Everything except static assets and the API.
   *
   * API routes authenticate on their own terms — a sensor API key, or a code
   * being exchanged for a session — and must not be redirected to an HTML
   * sign-in page.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|webp|svg|glb|gltf|opus|wav|m4a)$).*)",
  ],
};
