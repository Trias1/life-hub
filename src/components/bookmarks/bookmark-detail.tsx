"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Archive, Bookmark, Copy, ExternalLink, History, MoreVertical, RotateCcw, Star, StarOff } from "lucide-react"
import { TagChip } from "@/components/notes/tag-chip"
import { BookmarkFavicon } from "./bookmark-favicon"
import { bookmarkCollections, bookmarkHost, menuLinkClass } from "./bookmark-utils"

type BookmarkItem = { id: string; title: string; url: string; collection: string; tags: string[]; is_favorite: boolean; archived_at: string | null }
type ActivityItem = { id: string; actor: string; text: string; at: string; label: string }
type FormAction = (formData: FormData) => Promise<void>
type Props = {
  bookmark: BookmarkItem
  collections: string[]
  canEdit: boolean
  creatorName: string
  createdAt: string
  createdLabel: string
  updatedAt: string
  updatedLabel: string
  activity: ActivityItem[]
  actions: { updateBookmark: FormAction; toggleFavorite: FormAction; archiveBookmark: FormAction; restoreBookmark: FormAction }
}

export function BookmarkDetail({ bookmark, collections, canEdit, creatorName, createdAt, createdLabel, updatedAt, updatedLabel, activity, actions }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: bookmark.title, url: bookmark.url, collection: bookmark.collection, tags: bookmark.tags.join(", ") })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const archived = Boolean(bookmark.archived_at)
  const host = bookmarkHost(bookmark.url)
  const collectionOptions = Array.from(new Set([...bookmarkCollections, ...collections]))
  const draftTags = Array.from(new Set(draft.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [menuOpen])

  function startEditing() {
    setDraft({ title: bookmark.title, url: bookmark.url, collection: bookmark.collection, tags: bookmark.tags.join(", ") })
    setMessage("")
    setEditing(true)
  }

  async function save(formData: FormData) {
    setSaving(true)
    setMessage("")
    try {
      // Invalid input redirects back here with ?error=…, so reaching the next line means it saved.
      await actions.updateBookmark(formData)
      setEditing(false)
      setMessage("Changes saved")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function copyUrl() {
    setMenuOpen(false)
    try {
      await navigator.clipboard.writeText(bookmark.url)
      setMessage("Link copied")
    } catch {
      setMessage("Could not copy the link")
    }
  }

  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />

  return (
    <div className="issue-layout issue-detail">
      <article className="issue-main min-w-0">
        {archived && (
          <div role="status" className="issue-banner">
            <span>This bookmark is archived. It is hidden from the active list.</span>
            {canEdit && <form action={actions.restoreBookmark}>{hidden("id", bookmark.id)}<button className="button-secondary min-h-0 px-3 py-1.5 text-xs"><RotateCcw size={13} className="mr-1.5" />Restore</button></form>}
          </div>
        )}

        {editing ? (
          <form action={save} className="issue-form">
            {hidden("id", bookmark.id)}
            <div className="issue-form-field">
              <label htmlFor="edit-bookmark-url" className="issue-form-label">URL <span className="font-normal text-[var(--muted)]">(required)</span></label>
              <input id="edit-bookmark-url" required name="url" type="url" inputMode="url" pattern="https://.+" title="Links must start with https://" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} className="field-control" />
            </div>
            <div className="issue-form-field">
              <label htmlFor="edit-bookmark-title" className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
              <input id="edit-bookmark-title" required autoFocus maxLength={160} name="title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control" />
            </div>
            <div className="issue-form-field issue-form-narrow">
              <label htmlFor="edit-bookmark-collection" className="issue-form-label">Collection</label>
              <input id="edit-bookmark-collection" required maxLength={80} name="collection" list="edit-bookmark-collections" value={draft.collection} onChange={(event) => setDraft({ ...draft, collection: event.target.value })} className="field-control" />
              <datalist id="edit-bookmark-collections">{collectionOptions.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="issue-form-field issue-form-narrow">
              <label htmlFor="edit-bookmark-tags" className="issue-form-label">Tags</label>
              <input id="edit-bookmark-tags" name="tags" maxLength={500} value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="Separate tags with commas" className="field-control" />
              {draftTags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{draftTags.map((tag) => <TagChip key={tag} tag={tag} />)}</div>}
            </div>
            <div className="issue-form-actions">
              <button disabled={saving} className="button-primary disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
              <button type="button" onClick={() => { setEditing(false); setMessage("") }} disabled={saving} className="button-secondary">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <header className="issue-header">
              <h1 className="issue-title">{bookmark.title}</h1>
              <div className="flex shrink-0 items-center gap-2">
                {canEdit && !archived && <button type="button" onClick={startEditing} className="button-secondary min-h-0 px-3 py-1.5">Edit</button>}
                <div ref={menuRef} className="relative">
                  <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="button-quiet min-h-0 px-2 py-1.5"><MoreVertical size={16} /></button>
                  {menuOpen && (
                    <div role="menu" className="issue-menu">
                      <a role="menuitem" href={bookmark.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className={menuLinkClass}><ExternalLink size={14} />Open link</a>
                      <button type="button" role="menuitem" onClick={() => void copyUrl()}><Copy size={14} />Copy link</button>
                      {canEdit && <>
                        <form action={actions.toggleFavorite} onSubmit={() => setMenuOpen(false)}>{hidden("id", bookmark.id)}{hidden("favorite", bookmark.is_favorite ? "false" : "true")}<button role="menuitem">{bookmark.is_favorite ? <StarOff size={14} /> : <Star size={14} />}{bookmark.is_favorite ? "Remove from favourites" : "Add to favourites"}</button></form>
                        {archived
                          ? <form action={actions.restoreBookmark} onSubmit={() => setMenuOpen(false)}>{hidden("id", bookmark.id)}<button role="menuitem"><RotateCcw size={14} />Restore</button></form>
                          : <form action={actions.archiveBookmark} onSubmit={() => setMenuOpen(false)}>{hidden("id", bookmark.id)}<button role="menuitem"><Archive size={14} />Archive</button></form>}
                      </>}
                    </div>
                  )}
                </div>
              </div>
            </header>
            <p className="issue-meta">
              <span className="issue-state" data-state={archived ? "archived" : "active"}>{archived ? "Archived" : "Active"}</span>
              {bookmark.is_favorite && <span className="inline-flex items-center gap-1 text-[var(--foreground)]"><Star size={14} className="fill-current text-amber-500" aria-hidden />Favourite</span>}
              <BookmarkFavicon url={bookmark.url} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{host} · saved <time dateTime={createdAt} title={createdAt}>{createdLabel}</time> by <strong>{creatorName}</strong></span>
            </p>
            {message && <p role="status" className="mt-3 text-xs text-[var(--muted)]">{message}</p>}
            <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center">
              <BookmarkFavicon url={bookmark.url} size={24} className="hidden sm:grid" />
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all font-mono text-sm text-[var(--foreground)] hover:underline">{bookmark.url}</a>
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="button-primary min-h-0 shrink-0 px-3.5 py-2"><ExternalLink size={14} className="mr-1.5" aria-hidden />Open</a>
            </div>
          </>
        )}
      </article>

      <aside className="issue-sidebar">
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Collection</p>
          <p className="mt-1.5 text-sm [overflow-wrap:anywhere]"><Link href={"/bookmarks?collection=" + encodeURIComponent(bookmark.collection)} className="hover:underline">{bookmark.collection}</Link></p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Tags</p>
          {bookmark.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{bookmark.tags.map((tag) => <Link key={tag} href={"/bookmarks?tag=" + encodeURIComponent(tag)}><TagChip tag={tag} /></Link>)}</div> : <p className="mt-1.5 text-sm text-[var(--muted)]">None</p>}
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Added</p>
          <p className="mt-1.5 text-sm">{createdLabel} · {createdAt}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Last updated</p>
          <p className="mt-1.5 text-sm">{updatedLabel} · {updatedAt}</p>
        </div>
      </aside>
      <section className="issue-activity" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="issue-section-title">Activity</h2>
        <ol className="issue-timeline">
          {activity.map((item) => (
            <li key={item.id}>
              {item.text === "added this bookmark" ? <Bookmark size={14} aria-hidden /> : <History size={14} aria-hidden />}
              <div className="issue-timeline-text">
                <p><strong>{item.actor}</strong> {item.text} · <time dateTime={item.at} title={item.at}>{item.label}</time></p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
