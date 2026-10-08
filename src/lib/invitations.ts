import type { SupabaseClient } from "@supabase/supabase-js"

export type MyInvitation = { id: string; workspace_id: string; workspace_name: string; role: string; created_at: string; expires_at: string }

/**
 * Pending invitations addressed to the signed-in user's confirmed email.
 * Returns [] until migration 0029 (list_my_invitations) is applied, so the app keeps working without it.
 */
export async function listMyInvitations(supabase: SupabaseClient): Promise<MyInvitation[]> {
  const { data, error } = await supabase.rpc("list_my_invitations")
  if (error) {
    if (error.code !== "PGRST202" && error.code !== "42883") console.error("Could not load pending invitations", error.code)
    return []
  }
  return (data ?? []) as MyInvitation[]
}
