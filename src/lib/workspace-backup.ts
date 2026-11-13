import { gzipSync } from "node:zlib"
import { createAdminClient } from "@/lib/supabase/admin"
import { DriveNotConnectedError, getStorageForWorkspace } from "@/lib/storage/storage"
import { wibStamp } from "@/lib/backup-schedule.mjs"

/**
 * A workspace backup: every row of the workspace's data, gzipped JSON, written to its own Google Drive
 * (LifeHub/workspaces/<id>/backups). Encrypted columns (note content, task descriptions, bookmark URLs,
 * ...) are copied as stored, still encrypted: restoring needs the same DATA_ENCRYPTION_KEY.
 * Left out on purpose: Drive tokens, share-link and invitation token hashes, rate-limit counters, and
 * per-user secrets (2FA recovery codes). Files themselves already live in Drive.
 */
export const BACKUP_FORMAT = "lifehub-backup"
export const BACKUP_VERSION = 1

type Admin = ReturnType<typeof createAdminClient>
type Row = Record<string, unknown>

const BY_WORKSPACE: Array<[string, string]> = [
  ["workspace_settings", "*"],
  ["workspace_members", "*"],
  ["workspace_invitations", "id,workspace_id,email,role,expires_at,accepted_at,declined_at,created_by,created_at"],
  ["spaces", "*"],
  ["notes", "*"],
  ["note_versions", "*"],
  ["tasks", "*"],
  ["task_labels", "*"],
  ["calendar_events", "*"],
  ["bookmarks", "*"],
  ["files", "*"],
  ["file_versions", "*"],
  ["notifications", "*"],
  ["activity_logs", "*"],
]
const BY_TASK = ["task_comments", "task_checklist_items", "task_attachments", "task_label_assignments"]
const PAGE = 1000

async function allRows(admin: Admin, table: string, columns: string, column: string, values: string[]): Promise<Row[]> {
  const rows: Row[] = []
  // Chunk long id lists so the request URL stays short.
  for (let start = 0; start < values.length; start += 150) {
    const chunk = values.slice(start, start + 150)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select(columns).in(column, chunk).range(from, from + PAGE - 1)
      if (error) throw new Error("Could not read " + table)
      rows.push(...((data ?? []) as unknown as Row[]))
      if (!data || data.length < PAGE) break
    }
  }
  return rows
}

export async function buildBackup(admin: Admin, workspaceId: string) {
  const { data: workspace, error } = await admin.from("workspaces").select("id,owner_id,name,slug,created_at,updated_at").eq("id", workspaceId).maybeSingle()
  if (error || !workspace) throw new Error("Workspace not found")
  const tables: Record<string, Row[]> = { workspaces: [workspace as Row] }
  for (const [table, columns] of BY_WORKSPACE) tables[table] = await allRows(admin, table, columns, "workspace_id", [workspaceId])
  const taskIds = tables.tasks.map((task) => String(task.id))
  for (const table of BY_TASK) tables[table] = taskIds.length ? await allRows(admin, table, "*", "task_id", taskIds) : []
  const eventIds = tables.calendar_events.map((event) => String(event.id))
  tables.calendar_event_attendees = eventIds.length ? await allRows(admin, "calendar_event_attendees", "*", "event_id", eventIds) : []
  const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]))
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, created_at: new Date().toISOString(), workspace_id: workspaceId, encrypted_columns: "kept as stored (needs the same DATA_ENCRYPTION_KEY)", counts, tables }
}

function failureMessage(error: unknown) {
  if (error instanceof DriveNotConnectedError) return "Google Drive isn't connected for this workspace."
  return error instanceof Error && error.message.length < 200 ? error.message : "Backup failed."
}

/**
 * Builds a backup, uploads it, records it, removes backups beyond the keep count, and stores the
 * outcome on the schedule row. Never throws: returns ok/error for the caller to report.
 */
export async function runWorkspaceBackup(workspaceId: string, trigger: "scheduled" | "manual", userId?: string): Promise<{ ok: true; fileName: string; sizeBytes: number } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const startedAt = new Date()
  try {
    const backup = await buildBackup(admin, workspaceId)
    const body = gzipSync(Buffer.from(JSON.stringify(backup)), { level: 9 })
    const storage = getStorageForWorkspace(workspaceId)
    const parentId = await storage.ensureFolder(["workspaces", workspaceId, "backups"])
    const fileName = "lifehub-backup-" + wibStamp(startedAt) + ".json.gz"
    const uploaded = await storage.upload({ name: fileName, mimeType: "application/gzip", body, sizeBytes: body.byteLength, parentId })
    const { error: recordError } = await admin.from("workspace_backups").insert({ workspace_id: workspaceId, drive_file_id: uploaded.id, file_name: fileName, size_bytes: body.byteLength, trigger, created_by: userId ?? null })
    if (recordError) throw new Error("The backup was saved to Drive but couldn't be listed.")

    const { data: schedule } = await admin.from("workspace_backup_settings").select("keep_count").eq("workspace_id", workspaceId).maybeSingle()
    const keep = schedule?.keep_count ?? 14
    const { data: old } = await admin.from("workspace_backups").select("id,drive_file_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).range(keep, keep + 100)
    for (const row of old ?? []) {
      try {
        await storage.delete(row.drive_file_id)
      } catch {
        // Already gone from Drive (deleted by hand): just drop it from the list.
      }
      await admin.from("workspace_backups").delete().eq("id", row.id).eq("workspace_id", workspaceId)
    }
    await admin.from("workspace_backup_settings").update({ last_run_at: startedAt.toISOString(), last_status: "ok", last_error: null }).eq("workspace_id", workspaceId)
    return { ok: true, fileName, sizeBytes: body.byteLength }
  } catch (error) {
    const message = failureMessage(error)
    console.error("workspace backup failed", workspaceId, message)
    // last_run_at stays as it was, so the hourly job tries again next hour.
    await admin.from("workspace_backup_settings").update({ last_status: "failed", last_error: message.slice(0, 300) }).eq("workspace_id", workspaceId)
    return { ok: false, error: message }
  }
}
