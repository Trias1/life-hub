import { NextResponse } from "next/server"
import { z } from "zod"
import { isDue } from "@/lib/backup-schedule.mjs"
import { isCronRequest } from "@/lib/cron-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { runWorkspaceBackup } from "@/lib/workspace-backup"

export const runtime = "nodejs"
export const maxDuration = 300

// A few workspaces per call; the rest stay due and run at the next hourly call.
const PER_RUN = 5
const TOKEN_TTL_MS = 10 * 60 * 1000

type Admin = ReturnType<typeof createAdminClient>

/**
 * The hourly pg_cron job (migration 0041) sends a one-time token it just stored; using it deletes it,
 * so it works once and only within 10 minutes. A "Bearer CRON_SECRET" header (Vercel Cron) also works.
 */
async function isAuthorized(request: Request, admin: Admin) {
  if (isCronRequest(request)) return true
  const token = z.string().uuid().safeParse(new URL(request.url).searchParams.get("token"))
  if (!token.success) return false
  const { data, error } = await admin.from("cron_call_tokens").delete().eq("token", token.data).gte("created_at", new Date(Date.now() - TOKEN_TTL_MS).toISOString()).select("token")
  return !error && (data?.length ?? 0) === 1
}

/** Runs the workspace backups that are due (see src/lib/backup-schedule.mjs). */
export async function GET(request: Request) {
  const admin = createAdminClient()
  if (!(await isAuthorized(request, admin))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
