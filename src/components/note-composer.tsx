"use client"

import dynamic from "next/dynamic"
import "@uiw/react-md-editor/markdown-editor.css"
import { useEffect, useState } from "react"
import { Select } from "@/components/ui/select"

const MarkdownEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

type NoteAction = (formData: FormData) => Promise<void>

export function NoteComposer({ action }: { action: NoteAction }) {
  const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [folder, setFolder] = useState("General"); const [tags, setTags] = useState(""); const [saved, setSaved] = useState(false)
  useEffect(() => { const draft = window.localStorage.getItem("lifehub:note-draft"); if (!draft) return; try { const parsed = JSON.parse(draft) as { title?: string; content?: string; folder?: string; tags?: string }; setTitle(parsed.title ?? ""); setContent(parsed.content ?? ""); setFolder(parsed.folder ?? "General"); setTags(parsed.tags ?? "") } catch { window.localStorage.removeItem("lifehub:note-draft") } }, [])
  useEffect(() => { if (!title && !content && folder === "General" && !tags) return; window.localStorage.setItem("lifehub:note-draft", JSON.stringify({ title, content, folder, tags })); setSaved(true); const timeout = window.setTimeout(() => setSaved(false), 1200); return () => window.clearTimeout(timeout) }, [content, folder, tags, title])
  return <form action={action} onSubmit={() => window.localStorage.removeItem("lifehub:note-draft")} className="form-grid mt-5"><div className="grid gap-3 sm:grid-cols-[1fr_0.45fr]"><label className="field-label">Title<input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are you thinking about?" className="field-control" /></label><label className="field-label">Folder<Select name="folder" value={folder} onChange={setFolder} options={[{ value: "General", label: "General" }, { value: "Ideas", label: "Ideas" }, { value: "Projects", label: "Projects" }, { value: "Personal", label: "Personal" }]} /></label></div><label className="field-label">Tags<input name="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="design, planning" className="field-control" /><span className="text-xs font-normal text-zinc-400">Separate tags with commas.</span></label><div className="toolbar"><span className="text-xs text-zinc-400">{saved ? "Draft saved" : "Autosave on"}</span></div><div data-color-mode="light" className="mt-4"><MarkdownEditor value={content} onChange={(value) => setContent(value ?? "")} preview="edit" textareaProps={{ name: "content", "aria-label": "Note content", placeholder: "Write something… Use # heading, **bold**, or / commands." }} height={240} /></div><button className="button-primary w-fit">Add note</button></form>
}
