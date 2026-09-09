"use client"

import Link from "next/link"
import { Select } from "@/components/ui/select"
import { useEffect, useMemo, useState, useTransition } from "react"
import { accents, applyCustomizePreferences, defaultCustomizePreferences, readCustomizePreferences, type CustomizePreferences } from "@/lib/customize"

type Section = "general" | "appearance" | "workspace" | "notifications" | "security" | "integrations" | "backup" | "danger"
type GeneralSettings = { language: string; timezone: string; dateFormat: string; timeFormat: string }
type NotificationSettings = { mentionsEnabled: boolean; tasksEnabled: boolean; calendarEnabled: boolean; notesEnabled: boolean; filesEnabled: boolean; bookmarksEnabled: boolean }
type Props = { workspace: { name: string; slug: string }; initialGeneral: GeneralSettings; initialNotifications: NotificationSettings; driveConnected: boolean; canManageDrive: boolean; canManageSettings: boolean; disconnectDrive: () => Promise<void>; saveGeneralSettings: (formData: FormData) => Promise<void>; saveNotificationPreferences: (formData: FormData) => Promise<void>; deleteWorkspace: (formData: FormData) => Promise<void> }
const sections: Array<[Section, string, string]> = [["general", "General", "Language, date, and time"], ["appearance", "Appearance", "Theme and interface"], ["workspace", "Workspace", "Identity and members"], ["notifications", "Notifications", "Delivery preferences"], ["security", "Security", "Password and sessions"], ["integrations", "Integrations", "Connected services"], ["backup", "Backup", "Export and recovery"], ["danger", "Danger Zone", "Permanent actions"]]
const notificationOptions: Array<[keyof NotificationSettings, string]> = [["mentionsEnabled", "Mentions"], ["tasksEnabled", "Tasks"], ["calendarEnabled", "Calendar"], ["notesEnabled", "Notes"], ["filesEnabled", "Files"], ["bookmarksEnabled", "Bookmarks"]]

export function SettingsStudio({ workspace, initialGeneral, initialNotifications, driveConnected, canManageDrive, canManageSettings, disconnectDrive, saveGeneralSettings, saveNotificationPreferences, deleteWorkspace }: Props) {
  const [section, setSection] = useState<Section>("general")
  const [preferences, setPreferences] = useState(defaultCustomizePreferences)
  const [saved, setSaved] = useState("")
  const [general, setGeneral] = useState(initialGeneral)
  const [notificationPreferences, setNotificationPreferences] = useState(initialNotifications)
  const [isPending, startTransition] = useTransition()
  const active = useMemo(() => sections.find(([key]) => key === section)!, [section])

  useEffect(() => setPreferences(readCustomizePreferences()), [])
  function save() { if (section === "general") { const formData = new FormData(); Object.entries(general).forEach(([key, value]) => formData.set(key, value)); startTransition(() => { void saveGeneralSettings(formData).then(() => setSaved("Saved to workspace")) }); return } if (section === "notifications") { const formData = new FormData(); Object.entries(notificationPreferences).forEach(([key, value]) => formData.set(key, String(value))); startTransition(() => { void saveNotificationPreferences(formData).then(() => setSaved("Notification preferences saved")) }); return } applyCustomizePreferences(preferences); setSaved("Saved in this browser") }
  function changePreferences(next: CustomizePreferences) { setPreferences(next); applyCustomizePreferences(next); setSaved("Preview updated") }

  const appearance = <div className="space-y-6"><div><p className="eyebrow">Theme</p><div className="mt-3 flex flex-wrap gap-2">{(["light", "dark", "system"] as const).map((theme) => <button key={theme} type="button" onClick={() => changePreferences({ ...preferences, theme })} className={preferences.theme === theme ? "button-primary min-h-0 px-3 py-2 capitalize" : "button-secondary min-h-0 px-3 py-2 capitalize"}>{theme}</button>)}</div></div><label className="field-label">Accent color<Select value={preferences.accent} onChange={(value) => changePreferences({ ...preferences, accent: value as keyof typeof accents })} className="field-control" options={Object.entries(accents).map(([value, item]) => ({ value, label: item.label }))} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="field-label">Density<Select value={preferences.density} onChange={(value) => changePreferences({ ...preferences, density: value as "comfortable" | "compact" })} className="field-control" options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></label><label className="field-label">Corner radius<Select value={String(preferences.radius)} onChange={(value) => changePreferences({ ...preferences, radius: Number(value) })} className="field-control" options={[{ value: "10", label: "Small" }, { value: "16", label: "Medium" }, { value: "22", label: "Large" }]} /></label></div><Link href="/customize" className="button-secondary w-fit">Open full customization studio</Link></div>
  const generalContent = <div className="grid gap-4 sm:grid-cols-2"><label className="field-label">Language<Select value={general.language} onChange={(value) => setGeneral({ ...general, language: value })} className="field-control" options={[{ value: "English", label: "English" }]} /></label><label className="field-label">Timezone<Select value={general.timezone} onChange={(value) => setGeneral({ ...general, timezone: value })} className="field-control" options={[{ value: "Asia/Jakarta", label: "Asia/Jakarta" }, { value: "UTC", label: "UTC" }]} /></label><label className="field-label">Date format<Select value={general.dateFormat} onChange={(value) => setGeneral({ ...general, dateFormat: value })} className="field-control" options={[{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }]} /></label><label className="field-label">Time format<Select value={general.timeFormat} onChange={(value) => setGeneral({ ...general, timeFormat: value })} className="field-control" options={[{ value: "24-hour", label: "24-hour" }, { value: "12-hour", label: "12-hour" }]} /></label></div>
  const notificationContent = <div className="grid gap-3 sm:grid-cols-2">{notificationOptions.map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm font-medium"><span>{label}</span><input type="checkbox" checked={notificationPreferences[key]} onChange={(event) => setNotificationPreferences({ ...notificationPreferences, [key]: event.target.checked })} className="h-4 w-4 accent-black" /></label>)}</div>
  const integrations = <div className="space-y-5"><p className="max-w-xl text-sm leading-6 text-zinc-500">Connect Google Drive once for this workspace. Files and profile photos will use the connected Google account without manual refresh-token input.</p><div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/70 p-4"><div><p className="font-semibold">Google Drive</p><p className="mt-1 text-sm text-zinc-500">{driveConnected ? "Connected for this workspace." : "Not connected yet."}</p></div>{canManageDrive ? <div className="flex flex-wrap gap-2">{driveConnected ? <><Link href="/api/auth/google/login" className="button-secondary">Reconnect Google Drive</Link><form action={disconnectDrive}><button className="button-quiet text-red-600">Disconnect Google Drive</button></form></> : <Link href="/api/auth/google/login" className="button-primary">Connect Google Drive</Link>}</div> : <span className="text-sm text-zinc-500">Ask a workspace admin to connect it.</span>}</div></div>
  const utility = (title: string, description: string, href?: string) => <div className="space-y-4"><p className="max-w-xl text-sm leading-6 text-zinc-500">{description}</p>{href ? <Link href={href} className="button-secondary w-fit">Open {title}</Link> : <p className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm text-zinc-500">This area is ready for the related service when it is connected.</p>}</div>
  const securityContent = (
  <div className="space-y-5">
    <p className="max-w-xl text-sm leading-6 text-zinc-500">Manage account access, password verification, and active sessions.</p>
    <div className="rounded-2xl border border-zinc-200/70 p-5">
      <h4 className="font-semibold">Password & Authentication</h4>
      <p className="mt-1 text-sm text-zinc-500">Update your security settings or change your password.</p>
      <Link href="/profile" className="button-secondary mt-4 inline-flex">Go to Security Center</Link>
    </div>
  </div>
)

const backupContent = (
  <div className="space-y-4">
    <p className="max-w-xl text-sm leading-6 text-zinc-500">Download all workspace data including notes, tasks, calendar events, files metadata, and activity logs as a single JSON file.</p>
    <a href="/api/workspace/export" className="button-primary inline-flex">Download Workspace Backup (JSON)</a>
  </div>
)

const content = section === "general" ? generalContent
  : section === "appearance" ? appearance
  : section === "workspace" ? <div className="space-y-5"><div><p className="text-sm font-semibold">{workspace.name}</p><p className="mt-1 text-sm text-zinc-500">Workspace slug: {workspace.slug}</p></div>{utility("Workspace", "Manage members, roles, and workspace identity without crowding the main settings panel.", "/team")}</div>
  : section === "integrations" ? integrations
  : section === "notifications" ? notificationContent
  : section === "security" ? securityContent
  : section === "backup" ? backupContent
  : section === "danger" ? <div className="space-y-5"><p className="text-sm leading-6 text-zinc-500">Destructive workspace actions remain separated from daily preferences.</p><a href="/api/workspace/export" className="inline-flex rounded-xl border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-500">Export data</a>{canManageSettings && <form action={deleteWorkspace} className="rounded-2xl border border-red-500/30 p-4"><p className="font-semibold text-red-600">Delete workspace</p><p className="mt-1 text-sm text-zinc-500">This permanently removes the workspace and its data. Type the workspace name to confirm.</p><input name="confirmation" required className="field-control mt-3" placeholder={workspace.name} /><button className="mt-3 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">Delete workspace</button></form>}</div>
  : utility(active[1], active[2] + ".")

  return <div className="page-container"><header className="max-w-2xl"><p className="eyebrow">Workspace settings</p><h1 className="page-title">Settings</h1><p className="page-description">One focused panel at a time, with calm defaults and no admin-dashboard noise.</p></header><div className="mt-10 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]"><nav className="settings-nav lg:sticky lg:top-24 lg:h-fit" aria-label="Settings sections">{sections.map(([key, label, description]) => <button key={key} type="button" onClick={() => { setSection(key); setSaved("") }} className={section === key ? "settings-nav-item settings-nav-item-active" : "settings-nav-item"}><span>{label}</span><small>{description}</small></button>)}</nav><section className="settings-panel"><div className="border-b pb-6"><p className="eyebrow">{active[1]}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{active[2]}</h2></div><div className="py-7">{content}</div>{["general", "appearance", "notifications"].includes(section) && <div className="settings-save-bar"><span role="status" className="text-sm text-zinc-500">{saved || (section === "general" ? canManageSettings ? "Changes save to this workspace." : "Only workspace admins can change these settings." : section === "notifications" ? "Changes save to your account." : "Changes stay local until saved.")}</span><button type="button" onClick={save} disabled={isPending || (section === "general" && !canManageSettings)} className="button-primary">{isPending ? "Saving..." : "Save changes"}</button></div>}</section></div></div>
}
