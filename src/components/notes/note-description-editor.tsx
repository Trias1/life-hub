"use client"

import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, ChevronDown, Code, ImagePlus, Italic, Link2, List, ListOrdered, Quote, SquareCode, Strikethrough } from "lucide-react"
import { useEffect, useId, useState, type ReactNode } from "react"
import { noteContentToHtml, noteExtensions } from "./note-content"

type Props = { value: string; onChange: (value: string) => void; placeholder?: string; minHeight?: number; autoFocus?: boolean; labelledBy?: string }
type Block = "paragraph" | "h1" | "h2" | "h3"
const blocks: Array<[Block, string]> = [["paragraph", "Normal text"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"]]

/** Rich-text description field in the style of an issue tracker: one toolbar row, editor, hint footer. */
export function NoteDescriptionEditor({ value, onChange, placeholder = "Write a description or paste images here…", minHeight = 160, autoFocus = false, labelledBy }: Props) {
  const fileInputId = useId()
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const editor = useEditor({
    extensions: [...noteExtensions(), Placeholder.configure({ placeholder })],
    content: noteContentToHtml(value),
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { class: "note-prose note-editor-surface", style: "min-height:" + minHeight + "px", role: "textbox", "aria-multiline": "true", ...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": "Description" }) },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"))
        if (!file) return false
        event.preventDefault()
        insertImage(file)
        return true
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith("image/"))
        if (!file) return false
        event.preventDefault()
        insertImage(file)
        return true
      },
    },
    onUpdate: ({ editor: next }) => onChange(next.isEmpty ? "" : next.getHTML()),
  })

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? {
      block: (current.isActive("heading", { level: 1 }) ? "h1" : current.isActive("heading", { level: 2 }) ? "h2" : current.isActive("heading", { level: 3 }) ? "h3" : "paragraph") as Block,
      bold: current.isActive("bold"), italic: current.isActive("italic"), strike: current.isActive("strike"),
      quote: current.isActive("blockquote"), code: current.isActive("code"), codeBlock: current.isActive("codeBlock"),
      link: current.isActive("link"), bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"),
    } : null,
  })

  useEffect(() => {
    if (!editor || value === (editor.isEmpty ? "" : editor.getHTML())) return
    editor.commands.setContent(noteContentToHtml(value), { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    if (!blockMenuOpen) return
    const close = () => setBlockMenuOpen(false)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [blockMenuOpen])

  function insertImage(file: File) {
    if (!editor || !/^image\/(jpeg|png|gif|webp)$/.test(file.type)) return
    const reader = new FileReader()
    // Stored inline for now; the form uploads data: images to Drive before saving.
    reader.onload = () => typeof reader.result === "string" && editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run()
    reader.readAsDataURL(file)
  }

  function setBlock(block: Block) {
    setBlockMenuOpen(false)
    if (!editor) return
    if (block === "paragraph") editor.chain().focus().setParagraph().run()
    else editor.chain().focus().setHeading({ level: Number(block.slice(1)) as 1 | 2 | 3 }).run()
  }

  function toggleLink() {
    if (!editor) return
    if (editor.isActive("link")) return void editor.chain().focus().unsetLink().run()
    const url = window.prompt("Link URL (https://…)")
    if (!url) return
    if (!/^(https:\/\/|mailto:)/i.test(url.trim())) return window.alert("Links must start with https:// or mailto:")
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  const tool = (label: string, icon: ReactNode, on: boolean | undefined, action: () => void) => (
    // onMouseDown keeps the editor selection; the click runs the command.
    <button type="button" title={label} aria-label={label} aria-pressed={Boolean(on)} disabled={!editor} onMouseDown={(event) => event.preventDefault()} onClick={action} className={"note-tool" + (on ? " is-active" : "")}>{icon}</button>
  )
  const blockLabel = blocks.find(([key]) => key === active?.block)?.[1] ?? "Normal text"

  return (
    <div className="note-field">
      <div role="toolbar" aria-label="Formatting" className="note-tools">
        <div className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={blockMenuOpen} disabled={!editor} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); setBlockMenuOpen((open) => !open) }} className="note-block-trigger">
            {blockLabel}<ChevronDown size={14} aria-hidden />
          </button>
          {blockMenuOpen && (
            <div role="menu" className="note-block-menu">
              {blocks.map(([key, text]) => (
                <button key={key} type="button" role="menuitemradio" aria-checked={active?.block === key} onMouseDown={(event) => event.preventDefault()} onClick={() => setBlock(key)} className={"note-block-item note-block-" + key + (active?.block === key ? " is-active" : "")}>{text}</button>
              ))}
            </div>
          )}
        </div>
        <span className="note-tools-gap" aria-hidden />
        {tool("Bold", <Bold size={15} />, active?.bold, () => editor?.chain().focus().toggleBold().run())}
        {tool("Italic", <Italic size={15} />, active?.italic, () => editor?.chain().focus().toggleItalic().run())}
        {tool("Strikethrough", <Strikethrough size={15} />, active?.strike, () => editor?.chain().focus().toggleStrike().run())}
        <span className="note-tools-gap" aria-hidden />
        {tool("Quote", <Quote size={15} />, active?.quote, () => editor?.chain().focus().toggleBlockquote().run())}
        {tool("Inline code", <Code size={15} />, active?.code, () => editor?.chain().focus().toggleCode().run())}
        {tool("Code block", <SquareCode size={15} />, active?.codeBlock, () => editor?.chain().focus().toggleCodeBlock().run())}
        {tool("Link", <Link2 size={15} />, active?.link, toggleLink)}
        <span className="note-tools-gap" aria-hidden />
        {tool("Bulleted list", <List size={15} />, active?.bullet, () => editor?.chain().focus().toggleBulletList().run())}
        {tool("Numbered list", <ListOrdered size={15} />, active?.ordered, () => editor?.chain().focus().toggleOrderedList().run())}
        <span className="note-tools-gap" aria-hidden />
        {tool("Attach image", <ImagePlus size={15} />, false, () => document.getElementById(fileInputId)?.click())}
      </div>
      <div className="note-field-body">{editor ? <EditorContent editor={editor} /> : <div className="note-prose" style={{ minHeight }} aria-busy="true" />}</div>
      <p className="note-field-foot">Type <code>#</code> for a heading, <code>-</code> for a list, <code>```</code> for code. Paste or drop images to attach them.</p>
      <input id={fileInputId} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) insertImage(file); event.target.value = "" }} />
    </div>
  )
}
