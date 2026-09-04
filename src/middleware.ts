import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  GUEST_COOKIE,
  LOBBY_COOKIE,
  verifySession,
} from "@/lib/auth/session";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Guest tier: rotating 4-digit PIN ──────────────────────────────────────
  if (pathname.startsWith("/client")) {
    const session = await verifySession(
      request.cookies.get(GUEST_COOKIE)?.value,
      "guest"
    );

    if (pathname === PIN_ENTRY) {
      // Already authenticated: skip the pad rather than asking again.
      return session ? redirect(request, "/client") : NextResponse.next();
    }

    return session ? NextResponse.next() : redirect(request, PIN_ENTRY, pathname);
  }

  // ── Lobby tier: permanent kiosk code ──────────────────────────────────────
  if (pathname.startsWith("/lobby")) {
    const session = await verifySession(
      request.cookies.get(LOBBY_COOKIE)?.value,
      "lobby"
    );

    if (pathname === LOBBY_ENTRY) {
      return session ? redirect(request, "/lobby") : NextResponse.next();
    }

    return session ? NextResponse.next() : redirect(request, LOBBY_ENTRY, pathname);
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
    return redirect(
      request,
      staff.role === "super_admin" ? "/admin" : "/hotel-portal"
    );
  }

  if (!staff) {
    return redirect(request, SIGN_IN, pathname);
  }

  if (isAdminRoute && staff.role !== "super_admin") {
    // A resort employee who lands on /admin is sent to their own console
    // rather than shown a 403 they can do nothing about.
    return redirect(request, "/hotel-portal");
  }

  if (isPortalRoute) {
    // A super admin has no tenant of their own, so the portal has nothing to
    // show them; the estate view is where they belong.
    if (staff.role === "super_admin") return redirect(request, "/admin");
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
