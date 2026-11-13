import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptTokenWithKeys, encryptToken } from "@/lib/token-crypto.mjs"

// Service-account access (optional GOOGLE_DRIVE_CLIENT_EMAIL setup) keeps the full Drive scope.
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
// Workspace owners connect with drive.file: LifeHub only sees the files and folders it created
// itself, not the rest of the owner's Drive. Connections made before this keep their old scope
// until they reconnect.
export const GOOGLE_DRIVE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
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

/**
 * Keys for Google refresh tokens: GOOGLE_TOKEN_ENCRYPTION_KEY when set, else the Supabase secret
 * (older deployments). Tokens written under the Supabase secret stay readable and are re-encrypted
 * with the dedicated key the next time they are read.
 */
function tokenSecrets() {
  const dedicated = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
  const legacy = process.env.SUPABASE_SECRET_KEY
  const secrets = [dedicated || legacy, dedicated && legacy !== dedicated ? legacy : undefined].filter((secret): secret is string => Boolean(secret))
  if (!secrets.length) throw new Error("Missing token encryption configuration")
  return secrets
}

function tokenSecret() {
  return tokenSecrets()[0]
}

/** The plain refresh token, and whether it should be stored again under the current key. */
function readToken(stored: string) {
  const { token, keyIndex } = decryptTokenWithKeys(stored, tokenSecrets())
  return { token, stale: keyIndex !== 0 }
}

export function createGoogleOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(required("GOOGLE_CLIENT_ID"), required("GOOGLE_CLIENT_SECRET"), redirectUri)
}

export async function getWorkspaceDriveConnection(workspaceId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from("workspace_google_drive_connections").select("workspace_id,refresh_token,root_folder_id").eq("workspace_id", workspaceId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { token: refreshToken, stale } = readToken(data.refresh_token)
  if (stale) {
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
      await createGoogleOAuthClient().revokeToken(readToken(data.refresh_token).token)
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

export type GoogleCalendarEvent = { id: string; title: string; description: string; startsAt: string; endsAt: string; htmlLink: string | null }

export async function getGoogleCalendarEvents(userId: string, timeMin = new Date(), days = 90): Promise<GoogleCalendarEvent[]> {
  const { data, error } = await createAdminClient().from("google_oauth_tokens").select("refresh_token,scopes").eq("user_id", userId).maybeSingle()
  if (error || !data?.refresh_token) return []
  if (!data.scopes?.includes("https://www.googleapis.com/auth/calendar.readonly")) return []
  const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000)
  // Google events are optional extras: an unreadable token (e.g. encrypted under a previous key) or
  // missing OAuth config must not take the whole Calendar page down. Reconnecting Google fixes the token.
  try {
    const auth = createGoogleOAuthClient()
    const { token: refreshToken, stale } = readToken(data.refresh_token)
    auth.setCredentials({ refresh_token: refreshToken })
    if (stale) {
      const { error: rewriteError } = await createAdminClient().from("google_oauth_tokens").update({ refresh_token: encryptToken(refreshToken, tokenSecret()), updated_at: new Date().toISOString() }).eq("user_id", userId)
      if (rewriteError) console.error("Could not re-encrypt Google account token", rewriteError.message)
    }
    const calendar = google.calendar({ version: "v3", auth })
    const response = await calendar.events.list({ calendarId: "primary", timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: true, orderBy: "startTime", maxResults: 100 })
    return (response.data.items ?? []).flatMap((event) => {
      const start = event.start?.dateTime ?? (event.start?.date ? new Date(event.start.date + "T00:00:00").toISOString() : null)
      const end = event.end?.dateTime ?? (event.end?.date ? new Date(event.end.date + "T00:00:00").toISOString() : null)
      return event.id && start && end ? [{ id: event.id, title: event.summary ?? "Untitled event", description: event.description ?? "", startsAt: start, endsAt: end, htmlLink: event.htmlLink ?? null }] : []
    })
  } catch (error) {
    console.error("Could not load Google Calendar events", error instanceof Error ? error.message : "request failed")
    return []
  }
}
