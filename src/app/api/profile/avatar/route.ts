import { Readable } from "node:stream"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"

export const runtime = "nodejs"

/** Serves a profile photo: your own, or (?user=<id>) a member of your active workspace. */
export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const requested = request.nextUrl.searchParams.get("user")
  const target = requested ? z.string().uuid().safeParse(requested) : null
  if (target && !target.success) return new NextResponse(null, { status: 404 })
  const userId = target?.data ?? context.user.id

  let profile: { avatar_google_file_id: string | null; avatar_workspace_id: string | null } | null
  let workspaceIds: string[]
  if (userId === context.user.id) {
    const { data, error } = await context.supabase.from("profiles").select("avatar_google_file_id,avatar_workspace_id").eq("id", context.user.id).maybeSingle()
    if (error) return new NextResponse(null, { status: 404 })
    profile = data
    workspaceIds = context.memberships.map((membership) => membership.workspace_id)
  } else {
    // Someone else's photo: only for members of the viewer's active workspace. Profiles are owner-only under RLS, so read with the service role.
    const admin = createAdminClient()
    const { data: member } = await admin.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", userId).maybeSingle()
    if (!member) return new NextResponse(null, { status: 404 })
    const [{ data }, { data: memberships }] = await Promise.all([
      admin.from("profiles").select("avatar_google_file_id,avatar_workspace_id").eq("id", userId).maybeSingle(),
      admin.from("workspace_members").select("workspace_id").eq("user_id", userId),
    ])
    profile = data
    workspaceIds = (memberships ?? []).map((membership) => membership.workspace_id as string)
  }
  if (!profile?.avatar_google_file_id) return new NextResponse(null, { status: 404 })
  const candidates = workspaceIds.filter((workspaceId) => !profile.avatar_workspace_id || workspaceId === profile.avatar_workspace_id)

  for (const workspaceId of candidates) {
    try {
      const avatar = await getStorageForWorkspace(workspaceId).download(profile.avatar_google_file_id)
      return new NextResponse(Readable.toWeb(avatar.body) as ReadableStream, { headers: storageResponseHeaders(avatar, true) })
    } catch {
      continue
    }
  }

  return new NextResponse(null, { status: 404 })
}
