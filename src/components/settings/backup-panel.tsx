"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, Download, HardDriveDownload, TriangleAlert } from "lucide-react"
import { Select } from "@/components/ui/select"
import { nextSlot } from "@/lib/backup-schedule.mjs"

export type BackupSchedule = { frequency: "off" | "daily" | "weekly" | "monthly"; hour: number; weekday: number; month_day: number; keep_count: number; last_run_at: string | null; last_status: "ok" | "failed" | null; last_error: string | null }
export type BackupFile = { id: string; file_name: string; size_bytes: number; trigger: "scheduled" | "manual"; created_at: string }
type Props = {
  schedule: BackupSchedule
  backups: BackupFile[]
  isOwner: boolean
  driveConnected: boolean
  saveSchedule: (formData: FormData) => Promise<{ error?: string }>
  runNow: () => Promise<{ error?: string; fileName?: string }>
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const wibDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB"

/** Settings > Backup: the automatic backup schedule, "Back up now", recent backups, and the readable export. */
export function BackupPanel({ schedule, backups, isOwner, driveConnected, saveSchedule, runNow }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState(schedule)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const [running, startRunning] = useTransition()
  const changed = draft.frequency !== schedule.frequency || draft.hour !== schedule.hour || draft.weekday !== schedule.weekday || draft.month_day !== schedule.month_day || draft.keep_count !== schedule.keep_count
  const upcoming = useMemo(() => nextSlot(draft), [draft])

  function save() {
    const formData = new FormData()
    formData.set("frequency", draft.frequency)
    formData.set("hour", String(draft.hour))
    formData.set("weekday", String(draft.weekday))
    formData.set("monthDay", String(draft.month_day))
    formData.set("keepCount", String(draft.keep_count))
    setMessage(null)
    startSaving(async () => {
      const result = await saveSchedule(formData)
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "ok", text: draft.frequency === "off" ? "Automatic backups are off." : "Backup schedule saved." })
      if (!result.error) router.refresh()
    })
  }

  function backUpNow() {
    setMessage(null)
    startRunning(async () => {
      const result = await runNow()
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "ok", text: "Backup saved to Google Drive: " + result.fileName })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-[var(--line)] p-5" aria-labelledby="auto-backup-heading">
        <div>
          <h4 id="auto-backup-heading" className="font-semibold">Automatic backups</h4>
          <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-500">A copy of all workspace data (notes, tasks, calendar, bookmarks, file list, members and activity) is saved to this workspace&apos;s Google Drive, in LifeHub › backups. Encrypted parts stay encrypted, so a backup is only readable with this app&apos;s encryption key.</p>
        </div>
        {!driveConnected && <p role="status" className="flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-sm"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />Connect Google Drive (Settings › Integrations) so backups have somewhere to go.</p>}

        <fieldset disabled={!isOwner || saving} className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">How often
            <Select value={draft.frequency} onChange={(value) => setDraft({ ...draft, frequency: value as BackupSchedule["frequency"] })} className="field-control" options={[{ value: "off", label: "Off" }, { value: "daily", label: "Every day" }, { value: "weekly", label: "Every week" }, { value: "monthly", label: "Every month" }]} />
          </label>
          {draft.frequency === "weekly" && (
            <label className="field-label">Day
              <Select value={String(draft.weekday)} onChange={(value) => setDraft({ ...draft, weekday: Number(value) })} className="field-control" options={WEEKDAYS.map((label, index) => ({ value: String(index), label }))} />
            </label>
          )}
          {draft.frequency === "monthly" && (
            <label className="field-label">Day of the month
              <Select value={String(draft.month_day)} onChange={(value) => setDraft({ ...draft, month_day: Number(value) })} className="field-control" options={Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} />
            </label>
          )}
          {draft.frequency !== "off" && (
            <>
              <label className="field-label">Time (WIB)
                <Select value={String(draft.hour)} onChange={(value) => setDraft({ ...draft, hour: Number(value) })} className="field-control" options={Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: String(hour).padStart(2, "0") + ":00" }))} />
              </label>
              <label className="field-label">Keep
                <Select value={String(draft.keep_count)} onChange={(value) => setDraft({ ...draft, keep_count: Number(value) })} className="field-control" options={[7, 14, 30].map((count) => ({ value: String(count), label: "Last " + count + " backups" }))} />
              </label>
            </>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          {isOwner && <button type="button" onClick={save} disabled={!changed || saving} className="button-primary disabled:opacity-50">{saving ? "Saving…" : "Save schedule"}</button>}
          {isOwner && <button type="button" onClick={backUpNow} disabled={running || !driveConnected} className="button-secondary disabled:opacity-50"><HardDriveDownload size={15} className="mr-1.5" aria-hidden />{running ? "Backing up…" : "Back up now"}</button>}
          {!isOwner && <p className="text-sm text-zinc-500">Only the workspace owner can change backups.</p>}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-500">Next backup</dt><dd className="mt-0.5 font-medium">{upcoming ? wibDate.format(upcoming) + " WIB" : "Automatic backups are off"}{changed ? " (after you save)" : ""}</dd></div>
          <div><dt className="text-zinc-500">Last backup</dt><dd className="mt-0.5 font-medium">{schedule.last_status === "failed" ? <span className="text-danger">Failed: {schedule.last_error ?? "unknown error"}</span> : schedule.last_run_at ? wibDate.format(new Date(schedule.last_run_at)) + " WIB" : "None yet"}</dd></div>
        </dl>
        {message && <p role={message.tone === "error" ? "alert" : "status"} className={"flex items-center gap-2 text-sm " + (message.tone === "error" ? "text-danger" : "text-success")}>{message.tone === "ok" && <CheckCircle2 size={15} aria-hidden />}{message.text}</p>}
      </section>

      {isOwner && (
        <section className="space-y-3" aria-labelledby="recent-backups-heading">
          <h4 id="recent-backups-heading" className="font-semibold">Recent backups</h4>
          {backups.length ? (
            <ul className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
              {backups.map((backup) => (
                <li key={backup.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{wibDate.format(new Date(backup.created_at))} WIB</p>
                    <p className="text-xs text-zinc-500">{formatSize(backup.size_bytes)} · {backup.trigger === "manual" ? "Made by hand" : "Scheduled"}</p>
                  </div>
                  <a href={"/api/backup/" + backup.id} className="button-secondary min-h-0 px-3 py-1.5 text-sm" download><Download size={14} className="mr-1.5" aria-hidden />Download</a>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">No backups yet.</p>}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="readable-export-heading">
        <h4 id="readable-export-heading" className="font-semibold">Readable export</h4>
        <p className="max-w-xl text-sm leading-6 text-zinc-500">A one-off JSON file with everything decrypted, for reading or moving elsewhere. Keep it somewhere safe: it contains your notes in plain text.</p>
        <a href="/api/workspace/export" className="button-secondary inline-flex">Download readable export (JSON)</a>
      </section>
    </div>
  )
}
