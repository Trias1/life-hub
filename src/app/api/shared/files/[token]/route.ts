import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStorageForWorkspace } from "@/lib/storage/storage"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = z.string().uuid().safeParse((await params).token)
  if (!token.success) return NextResponse.json({ error: "Invalid share link" }, { status: 404 })
  const admin = createAdminClient()
  const tokenHash = createHash("sha256").update(token.data).digest("hex")
  const { data: share, error: shareError } = await admin.from("file_shares").select("file_id,workspace_id,expires_at").eq("token_hash", tokenHash).maybeSingle()
  if (shareError || !share || (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())) return NextResponse.json({ error: "Share link expired or not found" }, { status: 404 })
  const { data: file, error: fileError } = await admin.from("files").select("name,mime_type,size_bytes,google_file_id").eq("id", share.file_id).eq("workspace_id", share.workspace_id).maybeSingle()
  if (fileError || !file?.google_file_id) return NextResponse.json({ error: "File not found" }, { status: 404 })
  try {
    const download = await getStorageForWorkspace(share.workspace_id).download(file.google_file_id)
    const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment"
    return new NextResponse(Readable.toWeb(download.body) as ReadableStream, { headers: { "Content-Type": download.mimeType || file.mime_type, "Content-Length": String(download.sizeBytes || file.size_bytes), "Content-Disposition": disposition + "; filename*=UTF-8''" + encodeURIComponent(download.name || file.name), "Cache-Control": "private, no-store" } })
  } catch (downloadError) {
    console.error("download shared file")
    return NextResponse.json({ error: "Could not download shared file" }, { status: 502 })
  }
}
