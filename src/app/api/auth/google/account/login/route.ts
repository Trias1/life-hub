import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createGoogleOAuthClient, GOOGLE_ACCOUNT_SCOPES } from "@/lib/google-drive-auth"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.redirect(new URL("/login?error=Sign+in+to+connect+Google", request.url))
  try {
    const state = crypto.randomUUID()
    const callbackUrl = new URL("/api/auth/google/account/callback", request.url).toString()
    const client = createGoogleOAuthClient(callbackUrl)
    const authUrl = client.generateAuthUrl({ state, access_type: "offline", prompt: "consent", scope: GOOGLE_ACCOUNT_SCOPES, include_granted_scopes: true })
    const response = NextResponse.redirect(authUrl)
    response.cookies.set("lifehub_google_account_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 600, path: "/" })
    return response
  } catch (error) {
    console.error("google account oauth login", error instanceof Error ? error.message : "unknown error")
    return NextResponse.redirect(new URL("/profile?error=Google+OAuth+is+not+configured", request.url))
  }
}
