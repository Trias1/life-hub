import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"

export const runtime = "nodejs"

export async function GET() {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: profile, error } = await context.supabase.from("profiles").select("avatar_google_file_id,avatar_workspace_id").eq("id", context.user.id).maybeSingle()
  if (error || !profile?.avatar_google_file_id) return new NextResponse(null, { status: 404 })
  const workspaceIds = profile.avatar_workspace_id
    ? [profile.avatar_workspace_id]
    : context.memberships.map((membership) => membership.workspace_id)

  for (const workspaceId of workspaceIds) {
    try {
      const avatar = await getStorageForWorkspace(workspaceId).download(profile.avatar_google_file_id)
      if (!profile.avatar_workspace_id) {
        await context.supabase
          .from("profiles")
          .update({ avatar_workspace_id: workspaceId })
          .eq("id", context.user.id)
      }
      return new NextResponse(Readable.toWeb(avatar.body) as ReadableStream, { headers: { "Content-Type": avatar.mimeType, "Cache-Control": "private, max-age=3600" } })
    } catch {
      continue
    }
  }

  return new NextResponse(null, { status: 404 })
}
