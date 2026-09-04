"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * End the Supabase session and return to the sign-in page.
 *
 * Uses the writable server client so the auth cookies are actually cleared;
 * the read-only one would drop the deletion silently and leave the browser
 * holding a session the server no longer honours.
 */
export async function signOut(): Promise<never> {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
