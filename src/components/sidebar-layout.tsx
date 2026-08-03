"use client"

import { useEffect, useState } from "react"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { PageMotion } from "@/components/page-motion"
import { ActionFeedback } from "@/components/action-feedback"
import { NotificationRealtime } from "@/components/notification-realtime"
import { Sidebar } from "@/components/sidebar"
import { TopNavbar } from "@/components/top-navbar"
import { applyCustomizePreferences, readCustomizePreferences } from "@/lib/customize"

type SignOutAction = () => Promise<void>
type CreateSpaceAction = (formData: FormData) => Promise<void>
type SpaceAction = (formData: FormData) => Promise<void>
type SelectWorkspaceAction = (formData: FormData) => Promise<void>
type MarkAllReadAction = () => Promise<void>
type NotificationItem = { id: string; message: string; type: string; is_read: boolean; created_at: string }
type SidebarLayoutProps = { children: React.ReactNode; user: { id: string; email: string; displayName: string; avatarUrl: string | null }; workspace: { id: string; name: string; plan: string; isOwner: boolean }; workspaces: Array<{ id: string; name: string; owner_id: string }>; counts: { tasks: number; notifications: number; activity: number; storageBytes: number }; spaces: Array<{ id: string; name: string; color: string }>; notifications: NotificationItem[]; createSpace: CreateSpaceAction; updateSpace: SpaceAction; archiveSpace: SpaceAction; deleteSpace: SpaceAction; selectWorkspace: SelectWorkspaceAction; signOut: SignOutAction; markAllRead: MarkAllReadAction }

export function SidebarLayout({ children, user, workspace, workspaces, counts, spaces, notifications, createSpace, updateSpace, archiveSpace, deleteSpace, selectWorkspace, signOut, markAllRead }: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const applyPreferences = () => {
      const preferences = readCustomizePreferences()
      applyCustomizePreferences(preferences)
      setCollapsed(preferences.sidebarMode === "icon" || window.localStorage.getItem("lifehub:sidebar-collapsed") === "true")
    }
    applyPreferences()
    let goChord = false
    let chordTimer: number | undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === "b") { event.preventDefault(); setCollapsed((value) => { const next = !value; window.localStorage.setItem("lifehub:sidebar-collapsed", String(next)); return next }) }
      if ((event.ctrlKey || event.metaKey) && key === "k") { event.preventDefault(); window.dispatchEvent(new Event("lifehub:open-global-search")) }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "t") { event.preventDefault(); window.dispatchEvent(new Event("lifehub:toggle-theme")) }
      if (key === "g") { goChord = true; if (chordTimer) window.clearTimeout(chordTimer); chordTimer = window.setTimeout(() => { goChord = false }, 1000); return }
      if (goChord) { const routes: Record<string, string> = { d: "/dashboard", n: "/notes", t: "/tasks", f: "/files" }; if (routes[key]) window.dispatchEvent(new CustomEvent("lifehub:go", { detail: routes[key] })); goChord = false }
    }
    window.addEventListener("lifehub:customize-change", applyPreferences)
    window.addEventListener("keydown", onKeyDown)
    return () => { window.removeEventListener("lifehub:customize-change", applyPreferences); window.removeEventListener("keydown", onKeyDown); if (chordTimer) window.clearTimeout(chordTimer) }
  }, [])

  return <div style={{ "--sidebar-width": collapsed ? "72px" : "var(--sidebar-expanded-width, 256px)" } as React.CSSProperties} className="min-h-screen bg-[var(--background)]"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} user={user} workspace={workspace} workspaces={workspaces} counts={counts} spaces={spaces} createSpace={createSpace} updateSpace={updateSpace} archiveSpace={archiveSpace} deleteSpace={deleteSpace} selectWorkspace={selectWorkspace} signOut={signOut} /><main className="dashboard-content min-h-screen transition-[margin] duration-[250ms] md:ml-[var(--sidebar-width)]"><TopNavbar user={user} workspace={workspace} notifications={notifications} signOut={signOut} markAllRead={markAllRead} /><PageMotion>{children}</PageMotion><ActionFeedback /><NotificationRealtime userId={user.id} /><KeyboardShortcuts /></main></div>
}
