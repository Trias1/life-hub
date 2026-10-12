import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = z.string().uuid().safeParse((await params).token)
  if (!token.success) return NextResponse.json({ error: "Invalid share link" }, { status: 404 })
  const admin = createAdminClient()
  const tokenHash = createHash("sha256").update(token.data).digest("hex")
  const { data: share, error: shareError } = await admin.from("file_shares").select("file_id,workspace_id,expires_at").eq("token_hash", tokenHash).maybeSingle()
  if (shareError || !share || (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())) return NextResponse.json({ error: "Share link expired or not found" }, { status: 404 })
  const { data: file, error: fileError } = await admin.from("files").select("name,mime_type,size_bytes,google_file_id").eq("id", share.file_id).eq("workspace_id", share.workspace_id).is("trashed_at", null).maybeSingle()
  if (fileError || !file?.google_file_id) return NextResponse.json({ error: "File not found" }, { status: 404 })
  try {
    const download = await getStorageForWorkspace(share.workspace_id).download(file.google_file_id)
    const headers = new Headers(storageResponseHeaders(download, new URL(request.url).searchParams.get("inline") === "1"))
    // Keep the secret link out of Referer headers and search engines.
    headers.set("Referrer-Policy", "no-referrer")
    headers.set("X-Robots-Tag", "noindex, nofollow")
    headers.set("Cache-Control", "private, no-store")
    return new NextResponse(Readable.toWeb(download.body) as ReadableStream, { headers })
  } catch {
    console.error("download shared file")
    return NextResponse.json({ error: "Could not download shared file" }, { status: 502 })
  }
}
