import { NextResponse } from "next/server"
import { getGoogleDriveAuthUrl } from "@/lib/google-drive-auth"
import { getWorkspaceContext } from "@/lib/workspace/server"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.redirect(new URL("/settings?error=Sign+in+to+connect+Google+Drive", request.url))
  if (!["admin", "super_admin"].includes(context.role)) return NextResponse.redirect(new URL("/settings?error=Only+workspace+admins+can+connect+Google+Drive", request.url))
  try {
    const state = crypto.randomUUID() + ":" + context.workspaceId
    const callbackUrl = new URL("/api/auth/google/callback", request.url).toString()
    const response = NextResponse.redirect(getGoogleDriveAuthUrl(state, callbackUrl))
    response.cookies.set("lifehub_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 600, path: "/" })
    return response
  } catch (error) {
    console.error("google oauth login", error instanceof Error ? error.message : "unknown error")
    return new Response("OAuth configuration is missing", { status: 500 })
  }
}
