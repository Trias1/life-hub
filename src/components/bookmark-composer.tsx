"use client"

import Link from "next/link"
import { useState, type FocusEvent } from "react"
import { useFormStatus } from "react-dom"
import { TagChip } from "@/components/notes/tag-chip"
import { bookmarkCollections } from "@/components/bookmarks/bookmark-utils"

type Props = { action: (formData: FormData) => Promise<void>; collections?: string[] }

export function BookmarkComposer({ action, collections = [] }: Props) {
  const [title, setTitle] = useState("")
  const [tagText, setTagText] = useState("")
  const [isFetching, setIsFetching] = useState(false)
  const collectionOptions = Array.from(new Set([...bookmarkCollections, ...collections]))
  const tagList = Array.from(new Set(tagText.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)

  async function handleUrlBlur(event: FocusEvent<HTMLInputElement>) {
    const url = event.target.value
    if (!url.startsWith("http") || title) return
    setIsFetching(true)
    try {
      const response = await fetch("/api/bookmarks/fetch-meta?url=" + encodeURIComponent(url))
      const data = await response.json() as { title?: string }
      if (data.title) setTitle((current) => current || data.title!.slice(0, 160))
    } catch {
      // Metadata is optional; bookmark creation still works without it.
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <form action={action} className="issue-form mt-6">
      <div className="issue-form-field">
        <label htmlFor="bookmark-url" className="issue-form-label">URL <span className="font-normal text-[var(--muted)]">(required)</span></label>
        <input id="bookmark-url" required autoFocus name="url" type="url" inputMode="url" pattern="https://.+" title="Links must start with https://" placeholder="https://example.com" className="field-control" onBlur={handleUrlBlur} />
        <p className="text-xs text-[var(--muted)]">Only https:// links are saved. The title is filled in from the page when it is empty.</p>
      </div>
      <div className="issue-form-field">
        <label htmlFor="bookmark-title" className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
        <div className="relative">
          <input id="bookmark-title" required maxLength={160} name="title" value={title} onChange={(event) => setTitle(event.target.value)} className="field-control w-full" />
          {isFetching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">Fetching…</span>}
        </div>
      </div>
      <div className="issue-form-field issue-form-narrow">
        <label htmlFor="bookmark-collection" className="issue-form-label">Collection</label>
        <input id="bookmark-collection" required maxLength={80} name="collection" defaultValue="General" list="bookmark-collection-options" className="field-control" />
        <datalist id="bookmark-collection-options">{collectionOptions.map((item) => <option key={item} value={item} />)}</datalist>
      </div>
      <div className="issue-form-field issue-form-narrow">
        <label htmlFor="bookmark-tags" className="issue-form-label">Tags</label>
        <input id="bookmark-tags" name="tags" maxLength={500} value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="Separate tags with commas" className="field-control" />
        {tagList.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tagList.map((tag) => <TagChip key={tag} tag={tag} />)}</div>}
      </div>
      <div className="issue-form-actions">
        <SubmitButton />
        <Link href="/bookmarks" className="button-secondary">Cancel</Link>
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="button-primary disabled:opacity-60">{pending ? "Creating…" : "Create bookmark"}</button>
}
