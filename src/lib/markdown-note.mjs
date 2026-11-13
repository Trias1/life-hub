// Turns a Markdown file (.md, e.g. exported from Notion or written by hand) into note HTML that the
// note editor understands: headings, paragraphs, lists (nested), code blocks, quotes, rules, links.
// Tables become lists (the editor has no tables). Everything is escaped first; links keep only
// https:/mailto: targets, and raw HTML in the file is shown as text, never as markup.

export const MARKDOWN_LIMITS = { bytes: 200 * 1024, files: 10, html: 150_000 }

const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const LANGUAGES = new Map([["bash", "bash"], ["sh", "bash"], ["shell", "bash"], ["zsh", "bash"], ["console", "bash"], ["sql", "sql"], ["json", "json"], ["yaml", "yaml"], ["yml", "yaml"], ["javascript", "javascript"], ["js", "javascript"], ["jsx", "javascript"], ["typescript", "typescript"], ["ts", "typescript"], ["tsx", "typescript"], ["python", "python"], ["py", "python"], ["ini", "ini"], ["xml", "xml"], ["html", "xml"], ["css", "css"], ["diff", "diff"], ["go", "go"], ["java", "java"], ["php", "php"], ["ruby", "ruby"], ["rust", "rust"]])

/** Inline Markdown on one line of text: `code`, **bold**, *italic*, [links](https://…), bare https URLs. */
export function inlineHtml(text) {
  const tokens = []
  const keep = (html) => "\u0000" + (tokens.push(html) - 1) + "\u0000"
  const safeUrl = (url) => (/^(https:\/\/|mailto:)/i.test(url) ? url : null)
  let out = String(text)
    .replace(/`([^`]+)`/g, (_, code) => keep("<code>" + escapeHtml(code) + "</code>"))
    .replace(/!?\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g, (_, label, url) => {
      const href = safeUrl(url)
      const shown = label.trim() || url
      return href ? keep('<a href="' + escapeHtml(href) + '">' + escapeHtml(shown) + "</a>") : keep(escapeHtml(shown))
    })
    .replace(/https:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"]/g, (url) => keep('<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + "</a>"))
  out = escapeHtml(out)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?=\S)([^*]+?)(?<=\S)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_(?=\S)([^_]+?)(?<=\S)_(?!\w)/g, "$1<em>$2</em>")
  return out.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)])
}

const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())

/**
 * @param {string} markdown
 * @returns {{ title: string | null, html: string, headings: number }}
 */
export function markdownToNoteHtml(markdown) {
  const lines = String(markdown ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n")
  let title = null
  let headings = 0
  const html = []
  let paragraph = []
  const lists = [] // stack of { type, indent }
  let quote = []

  const flushParagraph = () => {
    if (paragraph.length) html.push("<p>" + paragraph.map(inlineHtml).join("<br>") + "</p>")
    paragraph = []
  }
  const closeLists = (toIndent = -1) => {
    while (lists.length && lists[lists.length - 1].indent > toIndent) html.push("</li></" + lists.pop().type + ">")
  }
  const flushQuote = () => {
    if (quote.length) html.push("<blockquote>" + quote.map((line) => "<p>" + inlineHtml(line) + "</p>").join("") + "</blockquote>")
    quote = []
  }
  const flushAll = () => {
    flushParagraph()
    flushQuote()
    closeLists()
  }

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]
    const line = raw.trim()
    const indent = raw.length - raw.trimStart().length

    // Fenced code (may be indented inside a list): keep its text exactly, minus the fence indent.
    const fence = line.match(/^(`{3,}|~{3,})\s*([\w+-]*)/)
    if (fence) {
      flushParagraph()
      flushQuote()
      const close = fence[1]
      const body = []
      for (index++; index < lines.length && !lines[index].trim().startsWith(close); index++) {
        const codeLine = lines[index]
        const leading = codeLine.length - codeLine.trimStart().length
        body.push(codeLine.slice(Math.min(indent, leading)))
      }
      const language = LANGUAGES.get(fence[2].toLowerCase())
      const code = "<pre><code" + (language ? ' class="language-' + language + '"' : "") + ">" + escapeHtml(body.join("\n")) + "</code></pre>"
      if (lists.length && indent > lists[lists.length - 1].indent) html.push(code)
      else {
        closeLists()
        html.push(code)
      }
      continue
    }

    if (!line) {
      flushParagraph()
      flushQuote()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*$/)
    if (heading) {
      flushAll()
      const text = heading[2].trim()
      if (heading[1].length === 1 && title === null && !html.length) {
        title = text.replace(/[*_`]/g, "").slice(0, 160)
        continue
      }
      const level = Math.min(Math.max(heading[1].length, 1), 3)
      html.push("<h" + level + ">" + inlineHtml(text) + "</h" + level + ">")
      headings++
      continue
    }

    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line)) {
      flushAll()
      html.push("<hr>")
      continue
    }

    if (line.startsWith(">")) {
      flushParagraph()
      closeLists()
      quote.push(line.replace(/^>\s?/, ""))
      continue
    }

    // Tables: one list item per row, "first cell — Header: value · …".
    if (line.startsWith("|") && index + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[index + 1].trim())) {
      flushAll()
      const header = splitRow(line)
      const items = []
      for (index += 2; index < lines.length && lines[index].trim().startsWith("|"); index++) {
        const cells = splitRow(lines[index])
        const [first, ...rest] = cells
        const details = rest.map((cell, column) => (cell && cell !== "–" && cell !== "-" ? (header[column + 1] ? escapeHtml(header[column + 1]) + ": " : "") + inlineHtml(cell) : null)).filter(Boolean)
        items.push("<li><p><strong>" + inlineHtml(first || "—") + "</strong>" + (details.length ? " — " + details.join(" · ") : "") + "</p></li>")
      }
      index--
      if (items.length) html.push("<ul>" + items.join("") + "</ul>")
      continue
    }

    const item = raw.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (item) {
      flushParagraph()
      flushQuote()
      const type = /\d/.test(item[2]) ? "ol" : "ul"
      const level = item[1].length
      const top = lists[lists.length - 1]
      if (!top || level > top.indent) {
        lists.push({ type, indent: level })
        html.push("<" + type + "><li>")
      } else {
        closeLists(level)
        const current = lists[lists.length - 1]
        if (current && current.type !== type && current.indent === level) {
          html.push("</li></" + lists.pop().type + "><" + type + "><li>")
          lists.push({ type, indent: level })
        } else if (current) html.push("</li><li>")
        else {
          lists.push({ type, indent: level })
          html.push("<" + type + "><li>")
        }
      }
      html.push("<p>" + inlineHtml(item[3]) + "</p>")
      continue
    }

    // Text indented under a list item belongs to that item.
    if (lists.length && indent > lists[lists.length - 1].indent) {
      html.push("<p>" + inlineHtml(line) + "</p>")
      continue
    }
    closeLists()
    flushQuote()
    paragraph.push(line)
  }
  flushAll()
  return { title, html: html.join(""), headings }
}

/** A note title from a file name: "TKP-Ops-Notes.md" → "TKP Ops Notes". */
export function titleFromFileName(name) {
  return String(name ?? "").replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Imported note"
}

/** Plain text → paragraphs (blank lines split them, single line breaks are kept). All text is escaped. */
export function plainTextToHtml(text) {
  return String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trimEnd()).filter((line, index, all) => line || (index > 0 && index < all.length - 1)))
    .filter((lines) => lines.some(Boolean))
    .map((lines) => "<p>" + lines.map((line) => escapeHtml(line)).join("<br>") + "</p>")
    .join("")
}
