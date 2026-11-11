"use client"

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react"
import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { accountInitials, splitNoteDoc } from "@/lib/note-blocks.mjs"
import { noteContentToHtml, noteExtensions } from "./note-content"

type Segment = { kind: "doc"; content: JSONContent[] } | { kind: "accounts"; groups: { value: string; labels: string[] }[] }

/**
 * Read-only rendering through the same TipTap schema as the editor: anything the schema does
 * not know (scripts, event handlers, iframes) is dropped instead of being injected as raw HTML.
 * With accountCards, lists of "label : value" lines show as one card per account (value).
 */
export function NoteViewer({ content, emptyText = "No description provided.", accountCards = false }: { content: string; emptyText?: string; accountCards?: boolean }) {
  const html = noteContentToHtml(content)
  const editor = useEditor({ extensions: noteExtensions(), content: html, editable: false, immediatelyRender: false, editorProps: { attributes: { class: "note-prose" } } })
  const [segments, setSegments] = useState<Segment[]>([])

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false })
    // The JSON comes out of the schema, so card text is plain strings rendered by React, never HTML.
    setSegments(accountCards ? (splitNoteDoc(editor.getJSON()) as Segment[]) : [])
  }, [editor, html, accountCards])

  if (!content.replace(/<[^>]*>/g, "").trim() && !/<img/i.test(content)) return <p className="note-prose-empty">{emptyText}</p>
  if (!editor) return <div className="note-prose" aria-busy="true" />
  if (!segments.some((segment) => segment.kind === "accounts")) return <EditorContent editor={editor} />
  return (
    <div className="note-segments">
      {segments.map((segment, index) => segment.kind === "accounts"
        ? <AccountCards key={index} groups={segment.groups} />
        : <DocSegment key={index} content={segment.content} />)}
    </div>
  )
}

function DocSegment({ content }: { content: JSONContent[] }) {
  const editor = useEditor({ extensions: noteExtensions(), content: { type: "doc", content }, editable: false, immediatelyRender: false, editorProps: { attributes: { class: "note-prose" } } })
  if (!editor) return <div className="note-prose" aria-busy="true" />
  return <EditorContent editor={editor} />
}

function AccountCards({ groups }: { groups: { value: string; labels: string[] }[] }) {
  return (
    <ul className="note-accounts" aria-label="Accounts">
      {groups.map((group) => (
        <li key={group.value} className="note-account">
          <span aria-hidden className="note-account-initials">{accountInitials(group.value)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="note-account-value">{group.value}</p>
              <CopyButton value={group.value} />
            </div>
            <ul className="note-account-labels" aria-label={"Used for " + group.labels.join(", ")}>
              {group.labels.map((label) => <li key={label}>{label}</li>)}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" onClick={() => void copy()} className="note-account-copy" aria-label={copied ? "Copied" : "Copy " + value} title={copied ? "Copied" : "Copy"}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  )
}
