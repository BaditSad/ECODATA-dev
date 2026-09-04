import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database, ProfileRow } from "@/types/database";

/**
 * Edge-safe session refresh.
 *
 * Supabase access tokens are short-lived. Middleware is the only place that can
 * both refresh them and write the rotated cookies back onto a response, so
 * every request passes through here before any guard decides anything.
 */

export interface StaffContext {
  userId: string;
  email: string;
  role: ProfileRow["role"];
  tenantId: string | null;
}

export interface SessionResult {
  /** Response carrying any rotated auth cookies. Guards must return or copy it. */
  response: NextResponse;
  /** Null when the caller has no valid staff session. */
  staff: StaffContext | null;
}

export async function updateSession(
  request: NextRequest
): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv();

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Mirror onto the request so downstream reads in this same pass see
          // the refreshed token, then rebuild the response to carry it out.
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  // getUser() revalidates against the auth server. getSession() only decodes
  // the cookie, which a client can forge, so it must not gate authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { response, staff: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  // A signup with no activated profile is authenticated but not authorized.
  if (!profile || !profile.is_active) {
    return { response, staff: null };
  }

  return {
    response,
    staff: {
      userId: user.id,
      email: user.email,
      role: profile.role,
      tenantId: profile.tenant_id,
    },
  };
}
