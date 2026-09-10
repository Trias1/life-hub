"use client"

import { useState, type FocusEvent } from "react"

type Props = { action: (formData: FormData) => Promise<void> }

export function BookmarkComposer({ action }: Props) {
  const [title, setTitle] = useState("")
  const [isFetching, setIsFetching] = useState(false)

  async function handleUrlBlur(event: FocusEvent<HTMLInputElement>) {
    const url = event.target.value
    if (!url.startsWith("http") || title) return
    setIsFetching(true)
    try {
      const response = await fetch("/api/bookmarks/fetch-meta?url=" + encodeURIComponent(url))
      const data = await response.json() as { title?: string }
      if (data.title) setTitle(data.title)
    } catch {
      // Metadata is optional; bookmark creation still works without it.
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <form action={action} className="mt-5 grid gap-3 md:grid-cols-[0.8fr_1.2fr_0.7fr_auto]">
      <div className="relative">
        <input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="field-control w-full" />
        {isFetching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">Fetching�</span>}
      </div>
      <input required name="url" type="url" placeholder="https://example.com" className="field-control" onBlur={handleUrlBlur} />
      <input required name="collection" defaultValue="General" placeholder="Collection" className="field-control" />
      <button className="button-primary">Add bookmark</button>
      <input name="tags" placeholder="Tags: design, research" className="field-control md:col-span-3" />
    </form>
  )
}
