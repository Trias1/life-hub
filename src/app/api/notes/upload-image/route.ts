import { NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const input = formData.get("file")
  const workspaceId = formData.get("workspaceId")
  if ((typeof input !== "string" && !(input instanceof File)) || typeof workspaceId !== "string" || workspaceId !== context.workspaceId) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 })
  }

  let file: File
  if (typeof input === "string") {
    const match = input.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) return NextResponse.json({ error: "Invalid image data" }, { status: 400 })
    const buffer = Buffer.from(match[2], "base64")
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_SIZE) return NextResponse.json({ error: "Image must be smaller than 5MB" }, { status: 400 })
    file = new File([buffer], "pasted-image", { type: match[1] })
  } else {
    file = input
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Only JPEG, PNG, GIF, or WebP images up to 5MB are allowed" }, { status: 400 })
  }

  try {
    const storage = getStorageForWorkspace(context.workspaceId)
    const parentId = await storage.ensureFolder(["workspaces", context.workspaceId, "images"])
    const uploaded = await storage.upload({ name: file.name.replace(/[^a-zA-Z0-9._-]/g, "-"), mimeType: file.type, body: Buffer.from(await file.arrayBuffer()), sizeBytes: file.size, parentId })
    return NextResponse.json({ url: "/api/images/" + encodeURIComponent(uploaded.id) })
  } catch {
    return NextResponse.json({ error: "Could not upload image" }, { status: 500 })
  }
}
