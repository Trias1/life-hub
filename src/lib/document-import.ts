import mammoth from "mammoth"
import { MARKDOWN_LIMITS, markdownToNoteHtml, plainTextToHtml, titleFromFileName } from "@/lib/markdown-note.mjs"

/** Files that become one note each. "title : text" lists in .txt keep their own importer. */
export const DOCUMENT_TYPES = [".md", ".markdown", ".docx", ".txt"] as const
export const DOCUMENT_LIMITS = { textBytes: MARKDOWN_LIMITS.bytes, docxBytes: 5 * 1024 * 1024, files: MARKDOWN_LIMITS.files, html: MARKDOWN_LIMITS.html }

type Converted = { title: string; html: string } | { error: string }
const extension = (name: string) => (name.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase()

/**
 * Word → note HTML. mammoth escapes all text; here images are dropped (they would be inlined as huge
 * data URLs), links keep only https:/mailto:, and ids/classes are removed. The note viewer then parses
 * the result through the editor schema, so anything else unknown is dropped there too.
 */
async function docxToHtml(buffer: Buffer) {
  const result = await mammoth.convertToHtml({ buffer }, { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) })
  return result.value
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\s(?:id|class|style)="[^"]*"/gi, "")
    .replace(/<a\b([^>]*)>/gi, (_, attributes: string) => {
      const href = attributes.match(/\shref="([^"]*)"/i)?.[1] ?? ""
      return /^(https:\/\/|mailto:)/i.test(href.replace(/&amp;/g, "&")) ? '<a href="' + href + '">' : "<a>"
    })
    .replace(/<a>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<table>([\s\S]*?)<\/table>/gi, (_, table: string) => tableToList(table))
    .replace(/<p>\s*<\/p>/g, "")
}

/** The editor has no tables: each row becomes a list item, cells joined with " · " (first cell bold). */
function tableToList(table: string) {
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map(([, row]) => [...row.matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) => cell.replace(/<\/p>\s*<p>/gi, " ").replace(/<\/?(p|ul|ol|li|h[1-6])>/gi, " ").replace(/\s+/g, " ").trim()))
  const items = rows.filter((cells) => cells.some(Boolean)).map(([first, ...rest]) => "<li><p><strong>" + (first || "—") + "</strong>" + (rest.filter(Boolean).length ? " · " + rest.filter(Boolean).join(" · ") : "") + "</p></li>")
  return items.length ? "<ul>" + items.join("") + "</ul>" : ""
}

export async function documentToNote(file: File): Promise<Converted> {
  const ext = extension(file.name)
  const fallbackTitle = titleFromFileName(file.name)
  if (ext === ".docx") {
    if (file.size > DOCUMENT_LIMITS.docxBytes) return { error: file.name + " is larger than 5 MB" }
    const buffer = Buffer.from(await file.arrayBuffer())
    // A .docx is a zip file; anything else (an old .doc, a renamed file) is refused.
    if (buffer.subarray(0, 4).toString("binary") !== "PK\u0003\u0004") return { error: file.name + " isn't a Word .docx file (save it as .docx)" }
    let html: string
    try {
      html = await docxToHtml(buffer)
    } catch {
      return { error: file.name + " couldn't be read" }
    }
    // A leading Heading 1 is the title, like the first "# " line in Markdown.
    const first = html.match(/^<h1>([\s\S]*?)<\/h1>/)
    const title = first ? first[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim().slice(0, 160) : ""
    return { title: title || fallbackTitle, html: first && title ? html.slice(first[0].length) : html }
  }
  if (ext !== ".md" && ext !== ".markdown" && ext !== ".txt") return { error: file.name + ": use .md, .docx or .txt" }
  if (file.size > DOCUMENT_LIMITS.textBytes) return { error: file.name + " is larger than 200 KB" }
  const text = await file.text()
  if (ext === ".txt") return { title: fallbackTitle, html: plainTextToHtml(text) }
  const converted = markdownToNoteHtml(text)
  return { title: converted.title || fallbackTitle, html: converted.html }
}
