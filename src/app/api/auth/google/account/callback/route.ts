import { NextRequest, NextResponse } from "next/server"
import { createGoogleOAuthClient, saveGoogleAccountConnection } from "@/lib/google-drive-auth"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  if (params.get("error")) return NextResponse.redirect(new URL("/profile?error=Google+authorization+was+cancelled", request.url))
  const code = params.get("code")
  const state = params.get("state")
  const savedState = request.cookies.get("lifehub_google_account_oauth_state")?.value
  if (!code || !state || !savedState || state !== savedState) return NextResponse.redirect(new URL("/profile?error=Invalid+Google+OAuth+state", request.url))
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.redirect(new URL("/login?error=Sign+in+to+connect+Google", request.url))
  try {
    const callbackUrl = new URL("/api/auth/google/account/callback", request.url).toString()
    const client = createGoogleOAuthClient(callbackUrl)
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token")
    await saveGoogleAccountConnection({ userId: context.user.id, refreshToken: tokens.refresh_token, scopes: (tokens.scope ?? "").split(" ").filter(Boolean) })
    const response = NextResponse.redirect(new URL("/profile?google=connected", request.url))
    response.cookies.delete("lifehub_google_account_oauth_state")
    return response
  } catch (error) {
    console.error("google account oauth callback", error instanceof Error ? error.message : "unknown error")
    return NextResponse.redirect(new URL("/profile?error=Could+not+connect+Google", request.url))
  }
}
