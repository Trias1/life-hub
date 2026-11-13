import { NextRequest, NextResponse } from "next/server"
import { createGoogleOAuthClient, saveGoogleAccountConnection } from "@/lib/google-drive-auth"
import { clearGoogleOAuth, finishGoogleOAuth } from "@/lib/google-oauth-flow"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const fail = (path: string, message: string) => clearGoogleOAuth(request, NextResponse.redirect(new URL(path + "?error=" + encodeURIComponent(message), request.url)), "account")
  if (request.nextUrl.searchParams.get("error")) return fail("/profile", "Google authorization was cancelled")
  const code = request.nextUrl.searchParams.get("code")
  const context = await getWorkspaceContext()
  if (!context) return fail("/login", "Sign in to connect Google")
  // The state must match the sign-in this same user started.
  const codeVerifier = finishGoogleOAuth(request, { flow: "account", userId: context.user.id })
  if (!code || !codeVerifier) return fail("/profile", "Invalid Google OAuth state. Start the connection again.")
  try {
    const client = createGoogleOAuthClient(new URL("/api/auth/google/account/callback", request.url).toString())
    const { tokens } = await client.getToken({ code, codeVerifier })
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token")
    await saveGoogleAccountConnection({ userId: context.user.id, refreshToken: tokens.refresh_token, scopes: (tokens.scope ?? "").split(" ").filter(Boolean) })
    return clearGoogleOAuth(request, NextResponse.redirect(new URL("/profile?google=connected", request.url)), "account")
  } catch (error) {
    console.error("google account oauth callback", error instanceof Error ? error.message : "unknown error")
    return fail("/profile", "Could not connect Google")
  }
}
