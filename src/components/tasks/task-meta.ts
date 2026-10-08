export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled"
export type TaskPriority = "low" | "medium" | "high"
export type TaskLabel = { id: string; name: string; color: string }

export const taskStatuses: Array<[TaskStatus, string]> = [["todo", "Todo"], ["in_progress", "In progress"], ["review", "Review"], ["done", "Done"], ["cancelled", "Cancelled"]]
export const statusLabel = (status: string) => taskStatuses.find(([key]) => key === status)?.[1] ?? status
export const openStatuses: TaskStatus[] = ["todo", "in_progress", "review"]
export const closedStatuses: TaskStatus[] = ["done", "cancelled"]
export const isOpenStatus = (status: string) => (openStatuses as string[]).includes(status)

export const priorityOptions = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]
/** Tones reuse the shared .tag-chip palette so chips follow light and dark themes. */
export const priorityTone: Record<string, string> = { high: "rose", medium: "amber", low: "sky" }
const labelTones: Record<string, string> = { indigo: "indigo", blue: "sky", emerald: "emerald", rose: "rose", amber: "amber" }
export const labelTone = (color: string) => labelTones[color] ?? "indigo"
export const labelColorOptions = [{ value: "indigo", label: "Indigo" }, { value: "blue", label: "Blue" }, { value: "emerald", label: "Emerald" }, { value: "rose", label: "Rose" }, { value: "amber", label: "Amber" }]

/** Profiles are only readable by their owner, so other members are shown by a short id. */
export function memberName(userId: string | null | undefined, currentUserId: string) {
  if (!userId) return "Unassigned"
  return userId === currentUserId ? "You" : "Member " + userId.slice(0, 8)
}

/** Today's date (YYYY-MM-DD) in the app's fixed time zone, so "overdue" matches the dates shown. */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(dateKey + "T00:00:00Z")
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
