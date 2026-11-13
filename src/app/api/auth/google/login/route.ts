import { NextResponse } from "next/server"
import { GOOGLE_DRIVE_OAUTH_SCOPES } from "@/lib/google-drive-auth"
import { startGoogleOAuth } from "@/lib/google-oauth-flow"
import { getWorkspaceContext } from "@/lib/workspace/server"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.redirect(new URL("/settings?error=Sign+in+to+connect+Google+Drive", request.url))
  if (context.role !== "super_admin") return NextResponse.redirect(new URL("/settings?error=Only+the+workspace+owner+can+connect+Google+Drive", request.url))
  try {
    const flow = await startGoogleOAuth(request, { flow: "drive", callbackPath: "/api/auth/google/callback", scopes: GOOGLE_DRIVE_OAUTH_SCOPES, userId: context.user.id, workspaceId: context.workspaceId })
    return flow.setCookie(NextResponse.redirect(flow.url))
  } catch (error) {
    console.error("google oauth login", error instanceof Error ? error.message : "unknown error")
    return new Response("OAuth configuration is missing", { status: 500 })
  }
}
