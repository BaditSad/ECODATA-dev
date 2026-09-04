import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Three callers, and no others:
 *   1. `/api/v1/ingest` — a balise has no Supabase identity; it authenticates
 *      with a hashed API key, so RLS has no claim to evaluate.
 *   2. The guest/lobby data layer — guests have no `auth.users` row either.
 *      `src/lib/data/guest.ts` is the only module allowed to use it there, and
 *      every query it issues is pinned to a tenant id taken from a *verified*
 *      session cookie. PIN verification and `/api/auth/presence` (Wi-Fi admit
 *      and remote-pass redemption) use the same client for the same reason.
 *   3. Platform automation — PIN rotation, sensor provisioning.
 *
 * Because RLS is inert here, tenant scoping becomes a code invariant. Never
 * pass a tenant id that came straight off a request without verifying it.
 */

export type AdminSupabaseClient = SupabaseClient<Database, "public">;

let cached: AdminSupabaseClient | null = null;

export function createAdminSupabase(): AdminSupabaseClient {
  if (cached) return cached;

  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  cached = createClient<Database, "public">(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // A service client is stateless: persisting or refreshing a session
        // would be meaningless and would keep timers alive on the server.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { "X-Client-Info": "ecodatalink-core/service" },
      },
    }
  );

  return cached;
}
