import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n")
const backup = read("../../../lib/workspace-backup.ts")
const cron = read("../../api/backup/cron/route.ts")
const download = read("../../api/backup/[id]/route.ts")
const actions = read("./actions.ts")
const limits = read("../../../lib/request-rate-limit.mjs")
const migration = read("../../../../supabase/migrations/0040_workspace_backups.sql")

test("backups copy workspace data as stored and leave secrets out", () => {
  for (const table of ["notes", "note_versions", "tasks", "calendar_events", "bookmarks", "files", "workspace_members", "activity_logs"]) assert.match(backup, new RegExp('\\["' + table + '", '))
  for (const table of ["task_comments", "task_checklist_items", "calendar_event_attendees"]) assert.ok(backup.includes('"' + table + '"'), table)
  assert.doesNotMatch(backup, /workspace_google_drive_connections|google_oauth_tokens|mfa_recovery_codes|file_shares|request_rate_limits/)
  assert.doesNotMatch(backup, /decryptField|decryptForExport/, "encrypted columns are not decrypted")
  assert.match(backup, /\["workspace_invitations", "id,workspace_id,email,role,expires_at,accepted_at,declined_at,created_by,created_at"\]/, "invitation token hashes stay out")
  assert.match(backup, /gzipSync\(/)
  assert.match(backup, /ensureFolder\(\["workspaces", workspaceId, "backups"\]\)/)
})

test("old backups beyond the keep count are removed, and failures retry next hour", () => {
  assert.match(backup, /\.order\("created_at", \{ ascending: false \}\)\.range\(keep, keep \+ 100\)/)
  assert.match(backup, /update\(\{ last_status: "failed", last_error: message\.slice\(0, 300\) \}\)/)
  assert.doesNotMatch(backup.slice(backup.indexOf("} catch (error) {")), /last_run_at:/, "a failure keeps the last run time, so it retries")
})

test("the hourly job needs the cron secret; downloads are owner only, from the backups folder", () => {
  assert.match(cron, /if \(!isCronRequest\(request\)\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/)
  assert.match(cron, /export async function GET\(/)
  assert.doesNotMatch(cron, /export async function POST\(/)
  assert.match(download, /context\.role !== "super_admin"/)
  assert.match(download, /\.from\("workspace_backups"\)\.select\("drive_file_id,file_name"\)\.eq\("id", id\.data\)\.eq\("workspace_id", context\.workspaceId\)/)
  assert.match(download, /storage\.download\(backup\.drive_file_id, \{ parentId: folder \}\)/)
  assert.match(limits, /path\.startsWith\("\/api\/backup\/"\) && path !== "\/api\/backup\/cron"\) return "export"/)
})

test("only the owner changes the schedule or makes a backup by hand, rate limited", () => {
  const save = actions.slice(actions.indexOf("export async function saveBackupSchedule"))
  assert.match(save, /context\.role !== "super_admin"/)
  assert.match(save, /updated_by: context\.user\.id/)
  const run = actions.slice(actions.indexOf("export async function runBackupNow"))
  assert.match(run, /context\.role !== "super_admin"/)
  assert.ok(run.indexOf("checkRequestLimit(context.supabase, \"export\")") < run.indexOf("runWorkspaceBackup("))
})

test("the database keeps the run record server-only and applies the 2FA rule", () => {
  assert.match(migration, /grant update \(frequency, hour, weekday, month_day, keep_count, updated_by, updated_at\) on public\.workspace_backup_settings to authenticated;/)
  assert.match(migration, /revoke insert, update, delete on public\.workspace_backups from anon, authenticated;/)
  assert.equal((migration.match(/create policy "require 2fa when enrolled"/g) ?? []).length, 2)
})
