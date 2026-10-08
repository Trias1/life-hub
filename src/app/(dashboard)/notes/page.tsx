import Link from "next/link"
import { redirect } from "next/navigation"
import { Pin, Search, SquarePen } from "lucide-react"
import { Select } from "@/components/ui/select"
import { TagChip } from "@/components/notes/tag-chip"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"

type NotesView = "active" | "archived" | "trash"
type Sort = "updated" | "created" | "title"
const PER_PAGE = 20

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; view?: string; note?: string; q?: string; label?: string; folder?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  // Old links (dashboard, search) pointed at /notes?note=<id>.
  if (params.note && /^[0-9a-f-]{36}$/i.test(params.note)) redirect("/notes/" + params.note)

  const view: NotesView = params.view === "archived" || params.view === "trash" ? params.view : "active"
  const sort: Sort = params.sort === "created" || params.sort === "title" ? params.sort : "updated"
  const q = (params.q ?? "").trim().slice(0, 100)
  const label = (params.label ?? "").trim().toLowerCase().slice(0, 40)
  const folder = (params.folder ?? "").trim().slice(0, 80)
  const context = await getWorkspaceContext()
  if (!context) return null
  const supabase = context.supabase

  const scoped = (state: NotesView) => {
    let query = supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId)
    if (state === "active") query = query.is("deleted_at", null).is("archived_at", null)
    if (state === "archived") query = query.is("deleted_at", null).not("archived_at", "is", null)
    if (state === "trash") query = query.not("deleted_at", "is", null)
    return query
  }

  let notesQuery = supabase.from("notes").select("id,title,content,folder,tags,is_favorite,created_at,updated_at").eq("workspace_id", context.workspaceId)
  if (view === "active") notesQuery = notesQuery.is("deleted_at", null).is("archived_at", null)
  if (view === "archived") notesQuery = notesQuery.is("deleted_at", null).not("archived_at", "is", null)
  if (view === "trash") notesQuery = notesQuery.not("deleted_at", "is", null)
  if (q) notesQuery = notesQuery.ilike("title", "%" + q.replace(/[%_\\]/g, (character) => "\\" + character) + "%")
  if (label) notesQuery = notesQuery.contains("tags", [label])
  if (folder) notesQuery = notesQuery.eq("folder", folder)
  notesQuery = sort === "title" ? notesQuery.order("title", { ascending: true }) : notesQuery.order(sort === "created" ? "created_at" : "updated_at", { ascending: false })

  const [{ data: notes }, activeCount, archivedCount, trashCount, { data: folderRows }] = await Promise.all([
    notesQuery.limit(500),
    scoped("active"),
    scoped("archived"),
    scoped("trash"),
    supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null),
  ])
  const counts = { active: activeCount.count ?? 0, archived: archivedCount.count ?? 0, trash: trashCount.count ?? 0 }
  // Pinned notes float to the top within the chosen sort, like pinned issues.
  const ordered = [...(notes ?? [])].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
  const totalPages = Math.max(1, Math.ceil(ordered.length / PER_PAGE))
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1))
  const pageNotes = ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const folders = Array.from(new Set((folderRows ?? []).map((row) => row.folder))).sort()
  const now = new Date()
  const filtered = Boolean(q || label || folder)

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { view: view === "active" ? undefined : view, q: q || undefined, label: label || undefined, folder: folder || undefined, sort: sort === "updated" ? undefined : sort, ...changes }
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value)
    const query = next.toString()
    return "/notes" + (query ? "?" + query : "")
  }

  return (
    <div className="page-container">
      {params.error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      {params.success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}

      <div className="issue-page-head">
        <h1 className="issue-title">Notes</h1>
        <Link href="/notes/new" className="button-primary min-h-0 px-3.5 py-2">New note</Link>
      </div>
      <div className="issue-list-head">
        <nav aria-label="Notes views" className="issue-tabs">
          {([["active", "Active"], ["archived", "Archived"], ["trash", "Trash"]] as const).map(([key, text]) => (
            <Link key={key} href={href({ view: key === "active" ? undefined : key, page: undefined })} aria-current={view === key ? "page" : undefined} className={"issue-tab" + (view === key ? " is-active" : "")}>
              {text}<span className="issue-tab-count">{counts[key]}</span>
            </Link>
          ))}
        </nav>
      </div>

      <form method="get" className="issue-filter">
        {view !== "active" && <input type="hidden" name="view" value={view} />}
        {label && <input type="hidden" name="label" value={label} />}
        <label className="issue-search">
          <Search size={15} aria-hidden />
          <span className="sr-only">Search notes by title</span>
          <input name="q" defaultValue={q} placeholder="Search by title…" />
        </label>
        <Select name="folder" defaultValue={folder} placeholder="All folders" className="field-control issue-filter-select" options={[{ value: "", label: "All folders" }, ...folders.map((item) => ({ value: item, label: item }))]} />
        <Select name="sort" defaultValue={sort} className="field-control issue-filter-select" options={[{ value: "updated", label: "Updated" }, { value: "created", label: "Created date" }, { value: "title", label: "Title" }]} />
        <button className="issue-filter-apply button-secondary min-h-0 px-3.5 py-2">Apply</button>
      </form>

      {(filtered) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          Showing {ordered.length} {ordered.length === 1 ? "note" : "notes"}
          {label && <>with label <TagChip tag={label} /></>}
          <Link href={href({ q: undefined, label: undefined, folder: undefined, page: undefined })} className="underline">Clear filters</Link>
        </p>
      )}

      {pageNotes.length ? (
        <ul className="issue-list">
          {pageNotes.map((note) => (
            <li key={note.id} className="issue-row">
              <SquarePen size={16} className="issue-row-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <Link href={"/notes/" + note.id} className="issue-row-title">{note.title}</Link>
                <p className="issue-row-meta">{note.folder} · created {relativeTime(note.created_at, now)}</p>
                {(note.tags ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(note.tags ?? []).map((tag: string) => <Link key={tag} href={href({ label: tag, page: undefined })}><TagChip tag={tag} /></Link>)}
                  </div>
                )}
              </div>
              <div className="issue-row-side">
                {note.is_favorite && <span className="issue-pin" title="Pinned"><Pin size={13} aria-hidden /><span className="sr-only">Pinned</span></span>}
                <span>updated {relativeTime(note.updated_at, now)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="issue-empty">
          <h2>{filtered ? "No notes match these filters" : view === "active" ? "No notes yet" : view === "archived" ? "Nothing archived" : "Trash is empty"}</h2>
          <p>{filtered ? "Try a different title, folder, or label." : view === "active" ? "Capture an idea, a decision, or a how-to so it is easy to find later." : "Notes you move here will show up in this list."}</p>
          {!filtered && view === "active" && <Link href="/notes/new" className="button-primary mt-4">New note</Link>}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="button-secondary min-h-0 px-3 py-1.5">Previous</Link> : <span />}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={href({ page: String(page + 1) })} className="button-secondary min-h-0 px-3 py-1.5">Next</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
