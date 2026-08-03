import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
export const GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback"

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error("Missing required Google OAuth configuration: " + name)
  return value
}

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(required("GOOGLE_CLIENT_ID"), required("GOOGLE_CLIENT_SECRET"), GOOGLE_OAUTH_REDIRECT_URI)
}

export function getGoogleDriveAuthUrl(state: string) {
  return createGoogleOAuthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: [GOOGLE_DRIVE_SCOPE], state })
}

export async function getWorkspaceDriveConnection(workspaceId: string) {
  const { data, error } = await createAdminClient().from("workspace_google_drive_connections").select("workspace_id,refresh_token,root_folder_id").eq("workspace_id", workspaceId).maybeSingle()
  if (error) throw error
  return data
}

export async function saveWorkspaceDriveConnection(input: { workspaceId: string; refreshToken: string; connectedBy: string }) {
  const { error } = await createAdminClient().from("workspace_google_drive_connections").upsert({ workspace_id: input.workspaceId, refresh_token: input.refreshToken, connected_by: input.connectedBy, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function saveWorkspaceDriveRoot(workspaceId: string, rootFolderId: string) {
  const { error } = await createAdminClient().from("workspace_google_drive_connections").update({ root_folder_id: rootFolderId, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId)
  if (error) throw error
}

export async function hasWorkspaceDriveConnection(workspaceId: string) {
  return Boolean((await getWorkspaceDriveConnection(workspaceId))?.refresh_token)
}
