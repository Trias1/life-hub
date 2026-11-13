import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { GOOGLE_ACCOUNT_SCOPES } from "@/lib/google-drive-auth"
import { startGoogleOAuth } from "@/lib/google-oauth-flow"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.redirect(new URL("/login?error=Sign+in+to+connect+Google", request.url))
  try {
    const flow = await startGoogleOAuth(request, { flow: "account", callbackPath: "/api/auth/google/account/callback", scopes: GOOGLE_ACCOUNT_SCOPES, userId: context.user.id, includeGrantedScopes: true })
    return flow.setCookie(NextResponse.redirect(flow.url))
  } catch (error) {
    console.error("google account oauth login", error instanceof Error ? error.message : "unknown error")
    return NextResponse.redirect(new URL("/profile?error=Google+OAuth+is+not+configured", request.url))
  }
}
