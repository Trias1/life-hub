import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"
import { Readable } from "node:stream"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fileId } = await params
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 })
  }

  try {
    const image = await getStorageForWorkspace(context.workspaceId).download(fileId)
    return new Response(Readable.toWeb(image.body) as ReadableStream, { headers: storageResponseHeaders(image, true) })
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }
}
