import Link from "next/link"
import { redirect } from "next/navigation"
import { ExternalLink, LayoutGrid, List, Search, Star } from "lucide-react"
import { Select } from "@/components/ui/select"
import { TagChip } from "@/components/notes/tag-chip"
import { BookmarkFavicon } from "@/components/bookmarks/bookmark-favicon"
import { BookmarkListMenu } from "@/components/bookmarks/bookmark-list-menu"
import { bookmarkHost } from "@/components/bookmarks/bookmark-utils"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"
import { importBookmarks } from "./actions"

type BookmarksView = "active" | "favorites" | "archived"
type Layout = "list" | "grid"
type Sort = "created" | "updated" | "title"
const PER_PAGE = 20

type Params = { error?: string; success?: string; view?: string; layout?: string; q?: string; collection?: string; tag?: string; sort?: string; page?: string; archived?: string; favorite?: string; bookmark?: string }

export default async function BookmarksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  // Old links used ?bookmark=<id>, ?archived=true, ?favorite=true, ?view=grid|list and ?collection=all.
  if (params.bookmark && /^[0-9a-f-]{36}$/i.test(params.bookmark)) redirect("/bookmarks/" + params.bookmark)
  if (params.archived !== undefined || params.favorite !== undefined || params.view === "grid" || params.view === "list" || params.collection === "all") {
    const next = new URLSearchParams()
    const legacyView = params.archived === "true" ? "archived" : params.favorite === "true" ? "favorites" : params.view === "archived" || params.view === "favorites" ? params.view : undefined
    const legacyLayout = params.view === "grid" || params.view === "list" ? params.view : params.layout
    const entries: Record<string, string | undefined> = { view: legacyView, layout: legacyLayout === "grid" ? "grid" : undefined, q: params.q, collection: params.collection === "all" ? undefined : params.collection, tag: params.tag, sort: params.sort, page: params.page, error: params.error, success: params.success }
    for (const [key, value] of Object.entries(entries)) if (value) next.set(key, value)
    redirect("/bookmarks" + (next.size ? "?" + next.toString() : ""))
  }

  const view: BookmarksView = params.view === "favorites" || params.view === "archived" ? params.view : "active"
  const layout: Layout = params.layout === "grid" ? "grid" : "list"
  const sort: Sort = params.sort === "updated" || params.sort === "title" ? params.sort : "created"
  const q = (params.q ?? "").trim().slice(0, 80)
  const query = q.toLowerCase()
  const collection = (params.collection ?? "").trim().slice(0, 80)
  const tag = (params.tag ?? "").trim().slice(0, 50).toLowerCase()
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: allBookmarks } = await context.supabase
    .from("bookmarks")
    .select("id,title,url,collection,tags,is_favorite,archived_at,created_at,updated_at")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false })
  const source = (allBookmarks ?? []).map((bookmark) => ({ ...bookmark, url: decryptField(FIELD.BOOKMARK_URL, bookmark.url) }))
  const inView = (bookmark: (typeof source)[number], state: BookmarksView) =>
    state === "archived" ? Boolean(bookmark.archived_at) : !bookmark.archived_at && (state === "active" || bookmark.is_favorite)
  const counts = {
    active: source.filter((bookmark) => inView(bookmark, "active")).length,
    favorites: source.filter((bookmark) => inView(bookmark, "favorites")).length,
    archived: source.filter((bookmark) => inView(bookmark, "archived")).length,
  }
  const bookmarks = source.filter(
    (bookmark) =>
      inView(bookmark, view) &&
      (!collection || bookmark.collection === collection) &&
      (!tag || (bookmark.tags ?? []).some((item: string) => item.toLowerCase() === tag)) &&
      (!query || bookmark.title.toLowerCase().includes(query) || bookmark.url.toLowerCase().includes(query) || bookmark.collection.toLowerCase().includes(query)),
  )
  if (sort === "title") bookmarks.sort((a, b) => a.title.localeCompare(b.title))
  if (sort === "updated") bookmarks.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const totalPages = Math.max(1, Math.ceil(bookmarks.length / PER_PAGE))
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1))
  const pageBookmarks = bookmarks.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const collections = Array.from(new Set(source.map((bookmark) => bookmark.collection))).sort()
  const tags = Array.from(new Set(source.flatMap((bookmark) => bookmark.tags ?? []))).sort()
  const now = new Date()
  const filtered = Boolean(q || collection || tag)

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { view: view === "active" ? undefined : view, layout: layout === "list" ? undefined : layout, q: q || undefined, collection: collection || undefined, tag: tag || undefined, sort: sort === "created" ? undefined : sort, ...changes }
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value)
    const search = next.toString()
    return "/bookmarks" + (search ? "?" + search : "")
  }

  const rowBody = (bookmark: (typeof source)[number]) => (
    <>
      <div className="flex min-w-0 items-start gap-1.5">
        <Link href={"/bookmarks/" + bookmark.id} className="issue-row-title min-w-0">{bookmark.title}</Link>
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer" title={"Open " + bookmark.url} className="mt-0.5 shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]">
          <ExternalLink size={13} aria-hidden /><span className="sr-only">Open {bookmarkHost(bookmark.url)} in a new tab</span>
        </a>
      </div>
      <p className="issue-row-meta [overflow-wrap:anywhere]">{bookmarkHost(bookmark.url)} · <Link href={href({ collection: bookmark.collection, page: undefined })} className="hover:underline">{bookmark.collection}</Link> · added {relativeTime(bookmark.created_at, now)}</p>
      {(bookmark.tags ?? []).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(bookmark.tags ?? []).map((item: string) => <Link key={item} href={href({ tag: item, page: undefined })}><TagChip tag={item} /></Link>)}
        </div>
      )}
    </>
  )

  return (
    <div className="page-container">
      {params.error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      {params.success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}

      <div className="issue-page-head">
        <h1 className="issue-title">Bookmarks</h1>
        <div className="flex shrink-0 items-center gap-2">
          <BookmarkListMenu importAction={importBookmarks} />
          <Link href="/bookmarks/new" className="button-primary min-h-0 px-3.5 py-2">New bookmark</Link>
        </div>
      </div>
      <div className="issue-list-head">
        <nav aria-label="Bookmark views" className="issue-tabs">
          {([["active", "Active"], ["favorites", "Favourites"], ["archived", "Archived"]] as const).map(([key, text]) => (
            <Link key={key} href={href({ view: key === "active" ? undefined : key, page: undefined })} aria-current={view === key ? "page" : undefined} className={"issue-tab" + (view === key ? " is-active" : "")}>
              {text}<span className="issue-tab-count">{counts[key]}</span>
            </Link>
          ))}
        </nav>
        <div role="group" aria-label="Layout" className="mb-1.5 ml-auto flex items-center gap-0.5">
          {([["list", "List view", List], ["grid", "Grid view", LayoutGrid]] as const).map(([key, text, Icon]) => (
            <Link key={key} href={href({ layout: key === "list" ? undefined : key })} aria-current={layout === key ? "page" : undefined} title={text} className={"rounded-md p-1.5 " + (layout === key ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]")}>
              <Icon size={16} aria-hidden /><span className="sr-only">{text}</span>
            </Link>
          ))}
        </div>
      </div>

      <form method="get" className="issue-filter sm:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem_auto]! max-sm:grid-cols-2!">
        {view !== "active" && <input type="hidden" name="view" value={view} />}
        {layout !== "list" && <input type="hidden" name="layout" value={layout} />}
        <label className="issue-search">
          <Search size={15} aria-hidden />
          <span className="sr-only">Search bookmarks</span>
          <input name="q" defaultValue={q} maxLength={80} placeholder="Search title, URL or collection…" />
        </label>
        <Select name="collection" defaultValue={collection} placeholder="All collections" className="field-control issue-filter-select" options={[{ value: "", label: "All collections" }, ...collections.map((item) => ({ value: item, label: item }))]} />
        <Select name="tag" defaultValue={tag} placeholder="All tags" className="field-control issue-filter-select" options={[{ value: "", label: "All tags" }, ...tags.map((item) => ({ value: item, label: "#" + item }))]} />
        <Select name="sort" defaultValue={sort} className="field-control issue-filter-select" options={[{ value: "created", label: "Created date" }, { value: "updated", label: "Updated" }, { value: "title", label: "Title" }]} />
        <button className="issue-filter-apply button-secondary min-h-0 px-3.5 py-2">Apply</button>
      </form>

      {filtered && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          Showing {bookmarks.length} {bookmarks.length === 1 ? "bookmark" : "bookmarks"}
          {collection && <>in <strong className="text-[var(--foreground)]">{collection}</strong></>}
          {tag && <>tagged <TagChip tag={tag} /></>}
          <Link href={href({ q: undefined, collection: undefined, tag: undefined, page: undefined })} className="underline">Clear filters</Link>
        </p>
      )}

      {pageBookmarks.length ? (
        layout === "grid" ? (
          <ul className="card-grid mt-4">
            {pageBookmarks.map((bookmark) => (
              <li key={bookmark.id} className="surface flex min-w-0 gap-3 p-4">
                <BookmarkFavicon url={bookmark.url} size={20} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  {rowBody(bookmark)}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    {bookmark.is_favorite && <Star size={12} className="fill-current text-amber-500" aria-label="Favourite" />}
                    updated {relativeTime(bookmark.updated_at, now)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="issue-list">
            {pageBookmarks.map((bookmark) => (
              <li key={bookmark.id} className="issue-row">
                <BookmarkFavicon url={bookmark.url} className="issue-row-icon" />
                <div className="min-w-0 flex-1">{rowBody(bookmark)}</div>
                <div className="issue-row-side">
                  {bookmark.is_favorite && <span title="Favourite" role="img" aria-label="Favourite"><Star size={13} className="fill-current text-amber-500" aria-hidden /></span>}
                  <span>updated {relativeTime(bookmark.updated_at, now)}</span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="issue-empty">
          <h2>{filtered ? "No bookmarks match these filters" : view === "active" ? "No bookmarks yet" : view === "favorites" ? "No favourites yet" : "Nothing archived"}</h2>
          <p>{filtered ? "Try a different search, collection, or tag." : view === "active" ? "Save a link so it is easy to find and revisit later. You can also import a CSV from the ⋮ menu." : view === "favorites" ? "Star a bookmark from its page to keep it here." : "Bookmarks you archive will show up in this list."}</p>
          {!filtered && view === "active" && <Link href="/bookmarks/new" className="button-primary mt-4">New bookmark</Link>}
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
