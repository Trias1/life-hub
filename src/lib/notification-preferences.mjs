const preferenceKeys = [
  ["mention", "mentions_enabled"],
  ["task", "tasks_enabled"],
  ["calendar", "calendar_enabled"],
  ["event", "calendar_enabled"],
  ["note", "notes_enabled"],
  ["file", "files_enabled"],
  ["bookmark", "bookmarks_enabled", false],
]

export function notificationEnabled(preferences, type) {
  const normalizedType = String(type).toLowerCase()
  const match = preferenceKeys.find(([keyword]) => normalizedType.includes(keyword))
  return match ? preferences?.[match[1]] ?? match[2] ?? true : true
}
