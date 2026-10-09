import { getWorkspaceContext } from "@/lib/workspace/server"
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"

type SearchResult = { id: string; type: "note" | "task" | "file" | "bookmark"; title: string; subtitle: string; href: string; updatedAt: string }

function searchPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (query.length < 2 || query.length > 80) return Response.json({ error: "Invalid search query" }, { status: 400 })

  const context = await getWorkspaceContext()
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const pattern = searchPattern(query)
  const [notes, tasks, files, bookmarks] = await Promise.all([
    context.supabase.from("notes").select("id,title,content,updated_at").eq("workspace_id", context.workspaceId).is("deleted_at", null).is("archived_at", null).ilike("title", pattern).order("updated_at", { ascending: false }).limit(10),
    context.supabase.from("tasks").select("id,title,status,priority,updated_at").eq("workspace_id", context.workspaceId).is("deleted_at", null).ilike("title", pattern).order("updated_at", { ascending: false }).limit(10),
    context.supabase.from("files").select("id,name,mime_type,folder,updated_at").eq("workspace_id", context.workspaceId).is("trashed_at", null).ilike("name", pattern).order("updated_at", { ascending: false }).limit(10),
    context.supabase.from("bookmarks").select("id,title,url,collection,updated_at").eq("workspace_id", context.workspaceId).is("archived_at", null).ilike("title", pattern).order("updated_at", { ascending: false }).limit(10),
  ])

  const failure = [notes, tasks, files, bookmarks].find((result) => result.error)
  if (failure?.error) {
    console.error("workspace search failed")
    return Response.json({ error: "Could not search workspace" }, { status: 500 })
  }

  const results: SearchResult[] = [
    ...(notes.data ?? []).map((note) => ({ id: note.id, type: "note" as const, title: note.title, subtitle: "Note", href: `/notes/${note.id}`, updatedAt: note.updated_at })),
    ...(tasks.data ?? []).map((task) => ({ id: task.id, type: "task" as const, title: task.title, subtitle: `${task.status.replaceAll("_", " ")} - ${task.priority} priority`, href: `/tasks/${task.id}`, updatedAt: task.updated_at })),
    ...(files.data ?? []).map((file) => ({ id: file.id, type: "file" as const, title: file.name, subtitle: `${file.folder} - ${file.mime_type}`, href: `/files?q=${encodeURIComponent(file.name)}`, updatedAt: file.updated_at })),
    ...(bookmarks.data ?? []).map((bookmark) => ({ id: bookmark.id, type: "bookmark" as const, title: bookmark.title, subtitle: `${bookmark.collection} - ${decryptField(FIELD.BOOKMARK_URL, bookmark.url)}`, href: `/bookmarks/${bookmark.id}`, updatedAt: bookmark.updated_at })),
  ].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt)).slice(0, 10)

  return Response.json({ results })
}
