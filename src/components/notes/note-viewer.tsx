"use client"

import { EditorContent, useEditor } from "@tiptap/react"
import { useEffect } from "react"
import { noteContentToHtml, noteExtensions } from "./note-content"

/**
 * Read-only rendering through the same TipTap schema as the editor: anything the schema does
 * not know (scripts, event handlers, iframes) is dropped instead of being injected as raw HTML.
 */
export function NoteViewer({ content, emptyText = "No description provided." }: { content: string; emptyText?: string }) {
  const html = noteContentToHtml(content)
  const editor = useEditor({ extensions: noteExtensions(), content: html, editable: false, immediatelyRender: false, editorProps: { attributes: { class: "note-prose" } } })

  useEffect(() => {
    if (editor && editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, html])

  if (!content.replace(/<[^>]*>/g, "").trim() && !/<img/i.test(content)) return <p className="note-prose-empty">{emptyText}</p>
  if (!editor) return <div className="note-prose" aria-busy="true" />
  return <EditorContent editor={editor} />
}
