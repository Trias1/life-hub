import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"

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
    return new Response(image.body as unknown as BodyInit, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }
}
