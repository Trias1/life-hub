import { getWorkspaceContext } from "@/lib/workspace/server"
import { FIELD, decryptForExport } from "@/lib/data-crypto.mjs"

const encryptedColumns: Record<string, Array<[string, string]>> = {
  spaces: [["description", FIELD.SPACE_DESCRIPTION]],
  notes: [["content", FIELD.NOTE_CONTENT]],
  tasks: [["description", FIELD.TASK_DESCRIPTION]],
  calendar: [["description", FIELD.EVENT_DESCRIPTION]],
  bookmarks: [["url", FIELD.BOOKMARK_URL]],
}

/** Exports stay human-readable: decrypt the encrypted columns of each exported table. */
function readable(name: string, data: unknown) {
  const columns = encryptedColumns[name]
  if (!columns || !Array.isArray(data)) return data
  return data.map((row: Record<string, unknown>) => ({ ...row, ...Object.fromEntries(columns.map(([column, family]) => [column, decryptForExport(family, row[column] as string | null)])) }))
}

export async function GET() {
  const context = await getWorkspaceContext()
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (context.role !== "super_admin") return Response.json({ error: "Workspace owner access required" }, { status: 403 })

  const tables = [
    ["workspace", context.supabase.from("workspaces").select("id,name,slug,owner_id,created_at").eq("id", context.workspaceId).maybeSingle()],
    ["settings", context.supabase.from("workspace_settings").select("timezone,language,date_format,time_format,storage_limit_bytes,updated_at").eq("workspace_id", context.workspaceId).maybeSingle()],
    ["members", context.supabase.from("workspace_members").select("user_id,role,created_at").eq("workspace_id", context.workspaceId)],
    ["spaces", context.supabase.from("spaces").select("*").eq("workspace_id", context.workspaceId)],
    ["notes", context.supabase.from("notes").select("*").eq("workspace_id", context.workspaceId)],
    ["tasks", context.supabase.from("tasks").select("*").eq("workspace_id", context.workspaceId)],
    ["calendar", context.supabase.from("calendar_events").select("*").eq("workspace_id", context.workspaceId)],
    ["files", context.supabase.from("files").select("*").eq("workspace_id", context.workspaceId)],
    ["bookmarks", context.supabase.from("bookmarks").select("*").eq("workspace_id", context.workspaceId)],
    ["activity", context.supabase.from("activity_logs").select("*").eq("workspace_id", context.workspaceId)],
  ] as const
  const results = await Promise.all(tables.map(([, query]) => query))
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    console.error("workspace export failed")
    return Response.json({ error: "Could not export workspace" }, { status: 500 })
  }

  const payload = Object.fromEntries(tables.map(([name], index) => [name, readable(name, results[index].data)]))
  const slug = String((payload.workspace as { slug?: string } | null)?.slug ?? "workspace").replace(/[^a-z0-9-]/gi, "-")
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), ...payload }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename=lifehub-${slug}.json` } })
}
