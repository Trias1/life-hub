import { NextResponse } from "next/server"
import { isDue } from "@/lib/backup-schedule.mjs"
import { isCronRequest } from "@/lib/cron-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { runWorkspaceBackup } from "@/lib/workspace-backup"

export const runtime = "nodejs"
export const maxDuration = 300

// A few workspaces per call; the rest stay due and run at the next hourly call.
const PER_RUN = 5

/** Called every hour by the Supabase pg_cron job (see migration 0040): runs the backups that are due. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createAdminClient()
  const { data: schedules, error } = await admin.from("workspace_backup_settings").select("workspace_id,frequency,hour,weekday,month_day,last_run_at,updated_at").neq("frequency", "off").limit(500)
  if (error) return NextResponse.json({ error: "Could not load backup schedules" }, { status: 500 })
  const now = new Date()
  const due = (schedules ?? []).filter((schedule) => isDue(schedule, now)).slice(0, PER_RUN)
  let ok = 0
  let failed = 0
  for (const schedule of due) {
    const result = await runWorkspaceBackup(schedule.workspace_id, "scheduled")
    if (result.ok) ok++
    else failed++
  }
  return NextResponse.json({ checked: schedules?.length ?? 0, ran: due.length, ok, failed }, { headers: { "Cache-Control": "no-store" } })
}
