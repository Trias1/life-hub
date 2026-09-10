import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptToken, encryptToken } from "@/lib/token-crypto.mjs"

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
export const GOOGLE_ACCOUNT_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/calendar.readonly"]

export function isGoogleInvalidGrant(error: unknown) {
  const value = error as { code?: number; response?: { status?: number; data?: { error?: unknown } } }
  return value.code === 400 && value.response?.status === 400 && value.response?.data?.error === "invalid_grant"
}

export async function clearWorkspaceDriveConnection(workspaceId: string) {
  const { error } = await createAdminClient().from("workspace_google_drive_connections").delete().eq("workspace_id", workspaceId)
  if (error) throw error
}

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error("Missing required Google OAuth configuration: " + name)
  return value
}

function tokenSecret() {
  // ponytail: reuse the existing server secret unless a dedicated encryption key is configured.
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error("Missing token encryption configuration")
  return secret
}

export function createGoogleOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(required("GOOGLE_CLIENT_ID"), required("GOOGLE_CLIENT_SECRET"), redirectUri)
}

export function getGoogleDriveAuthUrl(state: string, redirectUri: string) {
  return createGoogleOAuthClient(redirectUri).generateAuthUrl({ access_type: "offline", prompt: "consent", scope: [GOOGLE_DRIVE_SCOPE], state })
}

export async function getWorkspaceDriveConnection(workspaceId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from("workspace_google_drive_connections").select("workspace_id,refresh_token,root_folder_id").eq("workspace_id", workspaceId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const refreshToken = decryptToken(data.refresh_token, tokenSecret())
  if (!data.refresh_token.startsWith("v1:")) {
    const { error: migrationError } = await admin.from("workspace_google_drive_connections").update({ refresh_token: encryptToken(refreshToken, tokenSecret()), updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId)
    if (migrationError) throw migrationError
  }
  return { ...data, refresh_token: refreshToken }
}

export async function saveWorkspaceDriveConnection(input: { workspaceId: string; refreshToken: string; connectedBy: string }) {
  const { error } = await createAdminClient().from("workspace_google_drive_connections").upsert({ workspace_id: input.workspaceId, refresh_token: encryptToken(input.refreshToken, tokenSecret()), connected_by: input.connectedBy, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function disconnectWorkspaceDriveConnection(workspaceId: string) {
  const connection = await getWorkspaceDriveConnection(workspaceId)
  if (!connection) return
  try {
    await createGoogleOAuthClient().revokeToken(connection.refresh_token)
  } catch (error) {
    const response = error as { code?: number; response?: { status?: number; data?: { error?: unknown } } }
    const status = response.response?.status ?? response.code
    const errorCode = typeof response.response?.data?.error === "string" ? response.response.data.error : null
    console.error("Could not revoke Google Drive token", { status, errorCode })
    if (!(status === 400 && errorCode === "invalid_token")) throw new Error("Google token revocation failed")
  }
  const { error } = await createAdminClient().from("workspace_google_drive_connections").delete().eq("workspace_id", workspaceId)
  if (error) throw error
}

export async function saveWorkspaceDriveRoot(workspaceId: string, rootFolderId: string) {
  const { error } = await createAdminClient().from("workspace_google_drive_connections").update({ root_folder_id: rootFolderId, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId)
  if (error) throw error
}

export async function hasWorkspaceDriveConnection(workspaceId: string) {
  return Boolean((await getWorkspaceDriveConnection(workspaceId))?.refresh_token)
}

export async function hasGoogleAccountConnection(userId: string) {
  const { data, error } = await createAdminClient().from("google_oauth_tokens").select("user_id").eq("user_id", userId).maybeSingle()
  if (error) {
    if (error.code === "PGRST205") return false
    throw error
  }
  return Boolean(data)
}

export async function saveGoogleAccountConnection(input: { userId: string; refreshToken: string; scopes: string[] }) {
  const { error } = await createAdminClient().from("google_oauth_tokens").upsert({ user_id: input.userId, refresh_token: encryptToken(input.refreshToken, tokenSecret()), scopes: input.scopes, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function disconnectGoogleAccount(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("google_oauth_tokens").select("refresh_token").eq("user_id", userId).maybeSingle()
  if (data?.refresh_token) {
    try {
      await createGoogleOAuthClient().revokeToken(decryptToken(data.refresh_token, tokenSecret()))
    } catch (error) {
      const value = error as { response?: { status?: number; data?: { error?: unknown } }; code?: number }
      const status = value.response?.status ?? value.code
      const errorCode = value.response?.data?.error
      if (!(status === 400 && (errorCode === "invalid_token" || errorCode === "invalid_grant"))) throw error
    }
  }
  const { error } = await admin.from("google_oauth_tokens").delete().eq("user_id", userId)
  if (error) throw error
}
