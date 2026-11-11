// Reads a plain-text list (written in Notepad) into notes: "title : text" starts a note, the lines
// under it join that note. The browser uses this for the preview and the server re-reads the same
// file with it, so what gets saved never depends on what the browser sent back.
import { parseKeyValue } from "./note-blocks.mjs"

export const IMPORT_LIMITS = { bytes: 200 * 1024, entries: 100 }

const LIST_LINE = /^([-*•]|\d+[.)])\s+/

/** A note title is a short label: up to 40 characters and 6 words, so a sentence with a colon stays body text. */
function titleLine(line) {
  if (LIST_LINE.test(line)) return null
  const pair = parseKeyValue(line)
  if (!pair || pair.label.length > 40 || pair.label.split(" ").length > 6) return null
  return pair
}

/**
 * @param {string} text
 * @returns {{ entries: { title: string, lines: string[] }[], skipped: { line: number, text: string }[] }}
 */
export function parseNotesFile(text) {
  const entries = []
  const skipped = []
  const byTitle = new Map()
  let current = null
  String(text ?? "").replace(/^﻿/, "").split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line) {
      current = null
      return
    }
    const pair = titleLine(line)
    if (pair) {
      const key = pair.label.toLowerCase()
      current = byTitle.get(key)
      if (!current) {
        current = { title: pair.label, lines: [] }
        byTitle.set(key, current)
        entries.push(current)
      }
      current.lines.push(pair.value)
    } else if (current) {
      current.lines.push(line)
    } else {
      skipped.push({ line: index + 1, text: line })
    }
  })
  return { entries, skipped }
}

const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Note HTML for one entry: list lines ("- ", "* ", "1. ") become lists, everything else a paragraph. All text is escaped. */
export function entryHtml(entry) {
  let html = ""
  let open = null
  for (const line of entry.lines) {
    const marker = line.match(LIST_LINE)
    const kind = marker ? (/\d/.test(marker[1]) ? "ol" : "ul") : null
    if (open && open !== kind) {
      html += "</" + open + ">"
      open = null
    }
    if (kind && !open) {
      html += "<" + kind + ">"
      open = kind
    }
    html += kind ? "<li><p>" + escapeHtml(line.slice(marker[0].length)) + "</p></li>" : "<p>" + escapeHtml(line) + "</p>"
  }
  return open ? html + "</" + open + ">" : html
}
