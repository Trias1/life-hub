import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { data: version, error } = await context.supabase.from("file_versions").select("name,mime_type,size_bytes,storage_path").eq("id", id).eq("workspace_id", context.workspaceId).maybeSingle()
  if (error || !version) return NextResponse.json({ error: "Version not found" }, { status: 404 })
  const fileId = version.storage_path.replace(/^google-drive:/, "")
  try {
    const download = await getStorageForWorkspace(context.workspaceId).download(fileId)
    return new NextResponse(Readable.toWeb(download.body) as ReadableStream, { headers: storageResponseHeaders(download, new URL(request.url).searchParams.get("inline") === "1") })
  } catch {
    console.error("download file version")
    return NextResponse.json({ error: "Could not download file version" }, { status: 502 })
  }
}
