import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const storage = getStorageForWorkspace(context.workspaceId)
  const { id } = await params
  const { data: file, error } = await context.supabase.from("files").select("id,name,mime_type,size_bytes,google_file_id").eq("id", id).eq("workspace_id", context.workspaceId).maybeSingle()
  if (error || !file?.google_file_id) return NextResponse.json({ error: "File not found" }, { status: 404 })
  try {
    const download = await storage.download(file.google_file_id)
    return new NextResponse(Readable.toWeb(download.body) as ReadableStream, { headers: storageResponseHeaders(download, new URL(request.url).searchParams.get("inline") === "1") })
  } catch (downloadError) {
    console.error("download file")
    return NextResponse.json({ error: "Could not download file" }, { status: 502 })
  }
}
