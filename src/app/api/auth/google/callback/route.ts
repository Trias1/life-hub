import { NextRequest, NextResponse } from "next/server"
import { createGoogleOAuthClient, saveWorkspaceDriveConnection } from "@/lib/google-drive-auth"
import { clearGoogleOAuth, finishGoogleOAuth } from "@/lib/google-oauth-flow"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const fail = (message: string) => clearGoogleOAuth(request, NextResponse.redirect(new URL("/settings?error=" + encodeURIComponent(message), request.url)), "drive")
  if (request.nextUrl.searchParams.get("error")) return fail("Google authorization was cancelled")
  const code = request.nextUrl.searchParams.get("code")
  const context = await getWorkspaceContext()
  if (!context || context.role !== "super_admin") return fail("Workspace connection was not authorized")
  // The state must match the sign-in this same owner started for this same workspace.
  const codeVerifier = finishGoogleOAuth(request, { flow: "drive", userId: context.user.id, workspaceId: context.workspaceId })
  if (!code || !codeVerifier) return fail("Invalid Google OAuth state. Start the connection again.")

  try {
    const client = createGoogleOAuthClient(new URL("/api/auth/google/callback", request.url).toString())
    const { tokens } = await client.getToken({ code, codeVerifier })
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Reconnect with consent prompt.")
    await saveWorkspaceDriveConnection({ workspaceId: context.workspaceId, refreshToken: tokens.refresh_token, connectedBy: context.user.id })
    return clearGoogleOAuth(request, NextResponse.redirect(new URL("/settings?google=connected", request.url)), "drive")
  } catch (error) {
    console.error("google oauth callback", error instanceof Error ? error.message : "unknown error")
    return fail("Could not connect Google Drive")
  }
}
