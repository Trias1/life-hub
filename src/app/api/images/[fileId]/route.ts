import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"
import { Readable } from "node:stream"

export const runtime = "nodejs"

// Note images only: raster images uploaded through /api/notes/upload-image, which puts them directly
// in the workspace's "images" folder. Anything else in the workspace Drive (documents, files from the
// Files page, trashed items) isn't served here; those have their own routes with their own checks.
const NOTE_IMAGE = /^image\/(jpeg|png|gif|webp)$/

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
    const storage = getStorageForWorkspace(context.workspaceId)
    const imagesFolder = await storage.ensureFolder(["workspaces", context.workspaceId, "images"])
    const image = await storage.download(fileId, { parentId: imagesFolder, mimeType: NOTE_IMAGE })
    return new Response(Readable.toWeb(image.body) as ReadableStream, { headers: storageResponseHeaders(image, true) })
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }
}
