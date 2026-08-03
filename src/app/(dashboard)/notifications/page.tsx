import Link from "next/link"
import { Settings } from "lucide-react"
import { NotificationsCenter } from "@/components/notifications-center"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { archiveNotifications, deleteNotifications, markAllNotificationsRead, markNotificationRead, markNotificationsRead } from "./actions"

export default async function NotificationsPage() {
  const context = await getWorkspaceContext()
  if (!context) return null
  const { data: notifications } = await context.supabase.from("notifications").select("id,message,type,is_read,created_at,priority,resource_name,link").eq("recipient_id", context.user.id).is("archived_at", null).order("created_at", { ascending: false }).limit(200)
  const unread = notifications?.filter((item) => !item.is_read).length ?? 0

  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Stay in the loop</p><h1 className="page-title">Notifications</h1><p className="page-description">Mentions, assignments, security alerts, and workspace activity in one focused inbox.</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">{unread} unread</span>{unread > 0 && <form action={markAllNotificationsRead}><button className="button-secondary">Mark all as read</button></form>}<Link href="/settings" className="button-secondary min-h-0 p-2" aria-label="Notification settings"><Settings size={17} /></Link></div></header><NotificationsCenter notifications={notifications ?? []} markRead={markNotificationRead} markSelectedRead={markNotificationsRead} archiveSelected={archiveNotifications} deleteSelected={deleteNotifications} /></div>
}
