import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"

export const runtime = "nodejs"

export async function GET() {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const storage = getStorageForWorkspace(context.workspaceId)
  const { data: profile, error } = await context.supabase.from("profiles").select("avatar_google_file_id").eq("id", context.user.id).maybeSingle()
  if (error || !profile?.avatar_google_file_id) return new NextResponse(null, { status: 404 })
  try {
    const avatar = await storage.download(profile.avatar_google_file_id)
    return new NextResponse(Readable.toWeb(avatar.body) as ReadableStream, { headers: { "Content-Type": avatar.mimeType, "Cache-Control": "private, max-age=3600" } })
  } catch (downloadError) {
    console.error("download profile avatar", downloadError)
    return new NextResponse(null, { status: 404 })
  }
}
