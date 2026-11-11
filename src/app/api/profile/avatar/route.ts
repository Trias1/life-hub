import { Readable } from "node:stream"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { AVATAR_MARKER, readAvatar, saveAvatar, sniffAvatarType, type AvatarType } from "@/lib/avatar-storage"
import { createAdminClient } from "@/lib/supabase/admin"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"

export const runtime = "nodejs"

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
/** URLs carry ?v=<profile updated_at>, so a versioned response can be cached privately: a new photo gets a new URL. */
function photo(bytes: Uint8Array, type: AvatarType, versioned: boolean) {
  const headers = new Headers(storageResponseHeaders({ name: "avatar", mimeType: type }, true))
  if (versioned) headers.set("Cache-Control", "private, max-age=86400, immutable")
  return new NextResponse(Buffer.from(bytes), { headers })
}

/** Serves a profile photo: your own, or (?user=<id>) a member of your active workspace. */
export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const requested = request.nextUrl.searchParams.get("user")
  const target = requested ? z.string().uuid().safeParse(requested) : null
  if (target && !target.success) return new NextResponse(null, { status: 404 })
  const userId = target?.data ?? context.user.id
  const versioned = request.nextUrl.searchParams.has("v")
  const admin = createAdminClient()

  if (userId !== context.user.id) {
    // Someone else's photo: only for members of the viewer's active workspace.
    const { data: member } = await admin.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", userId).maybeSingle()
    if (!member) return new NextResponse(null, { status: 404 })
  }
  // Profiles are owner-only under RLS, so read with the service role (the id is the viewer's or a checked teammate's).
  const { data: profile } = await admin.from("profiles").select("avatar_url,avatar_google_file_id,avatar_workspace_id").eq("id", userId).maybeSingle()
  if (!profile) return new NextResponse(null, { status: 404 })

  if (profile.avatar_url === AVATAR_MARKER) {
    const stored = await readAvatar(userId)
    return stored ? photo(stored.bytes, stored.type, versioned) : new NextResponse(null, { status: 404 })
  }
  if (!profile.avatar_google_file_id) return new NextResponse(null, { status: 404 })

  // Older photos still live in a workspace's Google Drive: serve it once and move it to Storage, so it stops depending on that Drive.
  const { data: memberships } = await admin.from("workspace_members").select("workspace_id").eq("user_id", userId)
  const candidates = (memberships ?? []).map((membership) => membership.workspace_id as string).filter((workspaceId) => !profile.avatar_workspace_id || workspaceId === profile.avatar_workspace_id)
  for (const workspaceId of candidates) {
    try {
      const download = await getStorageForWorkspace(workspaceId).download(profile.avatar_google_file_id)
      const bytes = new Uint8Array(await new Response(Readable.toWeb(download.body) as ReadableStream).arrayBuffer())
      const type = sniffAvatarType(bytes)
      if (!type || bytes.byteLength > MAX_AVATAR_BYTES) continue
      try {
        await saveAvatar(userId, bytes, type)
        // Only switch the profile if it still points at this Drive file (a new upload may have happened meanwhile).
        await admin.from("profiles").update({ avatar_url: AVATAR_MARKER, avatar_google_file_id: null, avatar_workspace_id: null }).eq("id", userId).eq("avatar_google_file_id", profile.avatar_google_file_id)
      } catch {
        console.error("Could not move profile photo to storage")
      }
      return photo(bytes, type, versioned)
    } catch {
      continue
    }
  }
  return new NextResponse(null, { status: 404 })
}
