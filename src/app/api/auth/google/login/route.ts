import { NextResponse } from "next/server"
import { getGoogleDriveAuthUrl } from "@/lib/google-drive-auth"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not available in production", { status: 404 })
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.redirect(new URL("/settings?error=Sign+in+to+connect+Google+Drive", "http://localhost:3000"))
  if (!["admin", "super_admin"].includes(context.role)) return NextResponse.redirect(new URL("/settings?error=Only+workspace+admins+can+connect+Google+Drive", "http://localhost:3000"))
  try {
    const state = crypto.randomUUID() + ":" + context.workspaceId
    const response = NextResponse.redirect(getGoogleDriveAuthUrl(state))
    response.cookies.set("lifehub_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: false, maxAge: 600, path: "/" })
    return response
  } catch (error) {
    console.error("google oauth login", error)
    return new Response("OAuth configuration is missing", { status: 500 })
  }
}
