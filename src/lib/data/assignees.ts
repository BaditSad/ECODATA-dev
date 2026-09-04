import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";

export interface AssigneeOption {
  id: string;
  email: string;
  fullName: string | null;
}

export function assigneeLabel(account: AssigneeOption | null | undefined): string {
  if (!account) return "Unassigned";
  return account.fullName?.trim() || account.email;
}

/** Active platform accounts that can own a ticket or incident. */
export async function fetchPlatformAssignees(): Promise<AssigneeOption[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("role", ["super_admin", "platform_staff"])
    .eq("is_active", true)
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });

  if (error) throw new Error(`Assignee list failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
  }));
}
