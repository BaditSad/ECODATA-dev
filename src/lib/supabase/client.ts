"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Browser client for staff sessions (`/hotel-portal`, `/admin`).
 *
 * Carries the anon key, so every read it performs is bounded by Row Level
 * Security. Guest and lobby views never use it: those tiers have no Supabase
 * session and are served exclusively by tenant-pinned server code.
 */

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv();
  cached = createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return cached;
}
