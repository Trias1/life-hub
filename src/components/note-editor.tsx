"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { common, createLowlight } from "lowlight"

const lowlight = createLowlight(common)
type Props = { value: string; onChange: (value: string) => void; workspaceId: string; placeholder?: string; height?: number }
type TocItem = { id: string; text: string; level: number }

function markdownToHtml(value: string) {
  if (!value || /<\/?[a-z][\s\S]*>/i.test(value)) return value
  return value.split("\n").map((line) => {
    if (line.startsWith("### ")) return "<h3>" + line.slice(4) + "</h3>"
    if (line.startsWith("## ")) return "<h2>" + line.slice(3) + "</h2>"
    if (line.startsWith("# ")) return "<h1>" + line.slice(2) + "</h1>"
    if (line.startsWith("- ")) return "<ul><li>" + line.slice(2) + "</li></ul>"
    if (line.startsWith("> ")) return "<blockquote><p>" + line.slice(2) + "</p></blockquote>"
    if (/^!\[/.test(line)) return line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    return line ? "<p>" + line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") + "</p>" : "<p></p>"
  }).join("")
}

export function NoteEditor({ value, onChange, placeholder = "Start writing…", height = 240 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "tiptap-editor", style: "min-height: " + height + "px" },
      handleKeyDown: (_view, event) => {
        if (event.key === "/") setSlashOpen(true)
        if (event.key === "Escape") setSlashOpen(false)
        return false
      },
      handlePaste: (_view, event) => {
        const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"))
        if (!imageItem) return false
        event.preventDefault()
        const file = imageItem.getAsFile()
        if (file) insertImage(file)
        return true
      },
    },
    onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getHTML()),
  })

  function insertImage(file: File) {
    if (!editor) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result
      if (typeof base64 === "string") editor.chain().focus().setImage({ src: base64, alt: file.name }).run()
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!editor || editor.getHTML() === value || (!value && editor.isEmpty)) return
    editor.commands.setContent(markdownToHtml(value), { emitUpdate: false })
  }, [editor, value])

  const toc = useMemo<TocItem[]>(() => {
    if (!editor) return []
    const items: TocItem[] = []
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "heading") items.push({ id: "heading-" + position, text: node.textContent || "Untitled", level: Number(node.attrs.level) })
    })
    return items
    // `value` is a deliberate trigger: the editor mutates in place, so headings are re-read when the content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value])

  function command(action: () => void) {
    action()
    setSlashOpen(false)
  }

  if (!editor) return <div className="tiptap-editor" style={{ minHeight: height }} />
  return <div className="relative"><div className="tiptap-toolbar" role="toolbar" aria-label="Note formatting"><button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "is-active" : ""}>B</button><button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "is-active" : ""}>I</button><button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}>H1</button><div className="tiptap-toolbar-desktop">{[2, 3].map((level) => <button key={level} type="button" onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()} className={editor.isActive("heading", { level }) ? "is-active" : ""}>H{level}</button>)}<button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive("codeBlock") ? "is-active" : ""}>Code</button><button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "is-active" : ""}>• List</button><button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "is-active" : ""}>1. List</button><button type="button" onClick={() => inputRef.current?.click()}>Image</button></div><div className="tiptap-toolbar-mobile"><button type="button" aria-label="More formatting options" onClick={() => setToolbarOpen((open) => !open)}>…</button>{toolbarOpen && <div className="tiptap-toolbar-overflow"><button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button><button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button><button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Code</button><button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button><button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button><button type="button" onClick={() => inputRef.current?.click()}>Image</button></div>}</div></div><EditorContent editor={editor} /><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void insertImage(file); event.currentTarget.value = "" }} />{slashOpen && <div className="tiptap-slash-menu"><SlashItem label="Heading 1" onClick={() => command(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} /><SlashItem label="Heading 2" onClick={() => command(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} /><SlashItem label="Heading 3" onClick={() => command(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} /><SlashItem label="Bullet list" onClick={() => command(() => editor.chain().focus().toggleBulletList().run())} /><SlashItem label="Numbered list" onClick={() => command(() => editor.chain().focus().toggleOrderedList().run())} /><SlashItem label="Code block" onClick={() => command(() => editor.chain().focus().toggleCodeBlock().run())} /><SlashItem label="Image" onClick={() => command(() => inputRef.current?.click())} /></div>}<aside className="tiptap-toc mt-3">{toc.map((item) => <a key={item.id} href="#" style={{ paddingLeft: Math.max(0, item.level - 1) * 0.75 + "rem" }} onClick={(event) => event.preventDefault()}>{item.text}</a>)}</aside></div>
}

function SlashItem({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" className="tiptap-slash-menu-item" onClick={onClick}>{label}</button> }
