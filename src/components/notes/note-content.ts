import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { common, createLowlight } from "lowlight"

const lowlight = createLowlight(common)

/** Extensions shared by the note editor and the read-only viewer so both accept the same document. */
export function noteExtensions() {
  return [
    StarterKit.configure({ codeBlock: false, link: { openOnClick: false, defaultProtocol: "https", isAllowedUri: (url) => /^(https:|mailto:)/i.test(url) } }),
    CodeBlockLowlight.configure({ lowlight }),
    Image.configure({ inline: false, allowBase64: true }),
  ]
}

/** Older notes were stored as light markdown; newer ones are TipTap HTML. */
export function noteContentToHtml(value: string) {
  if (!value || /<\/?[a-z][\s\S]*>/i.test(value)) return value
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return value.split("\n").map((raw) => {
    const line = escape(raw)
    if (line.startsWith("### ")) return "<h3>" + line.slice(4) + "</h3>"
    if (line.startsWith("## ")) return "<h2>" + line.slice(3) + "</h2>"
    if (line.startsWith("# ")) return "<h1>" + line.slice(2) + "</h1>"
    if (line.startsWith("- ")) return "<ul><li>" + line.slice(2) + "</li></ul>"
    if (line.startsWith("&gt; ")) return "<blockquote><p>" + line.slice(5) + "</p></blockquote>"
    if (/^!\[/.test(line)) return line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    return line ? "<p>" + line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") + "</p>" : "<p></p>"
  }).join("")
}

export function noteExcerpt(value: string, length = 140) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, length)
}

const tagPalette = ["teal", "amber", "rose", "indigo", "emerald", "sky", "violet", "orange"] as const

/** Stable colour per tag name, so the same label always looks the same. */
export function tagTone(tag: string) {
  let hash = 0
  for (const character of tag) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return tagPalette[hash % tagPalette.length]
}

export const noteFolders = ["General", "Ideas", "Projects", "Personal"]
