import { NextRequest, NextResponse } from "next/server"
import { createGoogleOAuthClient, saveWorkspaceDriveConnection } from "@/lib/google-drive-auth"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not available in production", { status: 404 })
  const params = new URL(request.url).searchParams
  if (params.get("error")) return NextResponse.redirect(new URL("/settings?error=Google+authorization+was+cancelled", request.url))
  const code = params.get("code")
  const state = params.get("state")
  const savedState = request.cookies.get("lifehub_google_oauth_state")?.value
  if (!code || !state || !savedState || state !== savedState) return NextResponse.redirect(new URL("/settings?error=Invalid+Google+OAuth+state", request.url))
  const workspaceId = state.split(":")[1]
  const context = await getWorkspaceContext()
  if (!context || context.workspaceId !== workspaceId || !["admin", "super_admin"].includes(context.role)) return NextResponse.redirect(new URL("/settings?error=Workspace+connection+was+not+authorized", request.url))

  try {
    const client = createGoogleOAuthClient()
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Reconnect with consent prompt.")
    await saveWorkspaceDriveConnection({ workspaceId, refreshToken: tokens.refresh_token, connectedBy: context.user.id })
    const response = NextResponse.redirect(new URL("/settings?google=connected", request.url))
    response.cookies.delete("lifehub_google_oauth_state")
    return response
  } catch (error) {
    console.error("google oauth callback", error)
    return NextResponse.redirect(new URL("/settings?error=Could+not+connect+Google+Drive", request.url))
  }
}
