import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getStorageForWorkspace, storageResponseHeaders } from "@/lib/storage/storage"
import { getWorkspaceContext } from "@/lib/workspace/server"

export const runtime = "nodejs"

/** Downloads one backup file. Owner only (RLS on workspace_backups), from the workspace's backups folder. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) return NextResponse.json({ error: "Backup not found" }, { status: 404 })
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (context.role !== "super_admin") return NextResponse.json({ error: "Workspace owner access required" }, { status: 403 })
  const { data: backup } = await context.supabase.from("workspace_backups").select("drive_file_id,file_name").eq("id", id.data).eq("workspace_id", context.workspaceId).maybeSingle()
  if (!backup) return NextResponse.json({ error: "Backup not found" }, { status: 404 })
  try {
    const storage = getStorageForWorkspace(context.workspaceId)
    const folder = await storage.ensureFolder(["workspaces", context.workspaceId, "backups"])
    const file = await storage.download(backup.drive_file_id, { parentId: folder })
    const headers = new Headers(storageResponseHeaders({ ...file, name: backup.file_name }))
    headers.set("Cache-Control", "private, no-store")
    return new NextResponse(Readable.toWeb(file.body) as ReadableStream, { headers })
  } catch {
    return NextResponse.json({ error: "Could not download that backup. It may have been removed from Google Drive." }, { status: 404 })
  }
}
