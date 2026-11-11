import assert from "node:assert/strict"
import test from "node:test"
import { IMPORT_LIMITS, entryHtml, parseNotesFile } from "./notes-import.mjs"

test("each 'title : text' line starts a note; lines under it join that note", () => {
  const { entries, skipped } = parseNotesFile([
    "supabase : trias@gmail.com",
    "",
    "website : google cloud akun trias@gmail.com",
    "",
    "Migrasi LifeHub : 11 Nov, RLS member diperbaiki",
    "- tes di PGlite dulu",
    "- rollback ada di supabase/rollback",
  ].join("\r\n"))
  assert.deepEqual(entries, [
    { title: "supabase", lines: ["trias@gmail.com"] },
    { title: "website", lines: ["google cloud akun trias@gmail.com"] },
    { title: "Migrasi LifeHub", lines: ["11 Nov, RLS member diperbaiki", "- tes di PGlite dulu", "- rollback ada di supabase/rollback"] },
  ])
  assert.deepEqual(skipped, [])
})

test("consecutive title lines without blank lines still make separate notes", () => {
  const { entries } = parseNotesFile("supabase : a@x.com\nwebsite : b@x.com\nvercel : c@x.com")
  assert.deepEqual(entries.map((entry) => entry.title), ["supabase", "website", "vercel"])
})

test("list lines with a colon stay inside the note above them", () => {
  const { entries } = parseNotesFile("Supabase : akun per project\n- Life-hub : triaszulfa9@gmail.com\n* linktree : iaszaen0@gmail.com\n1. portfolio : iaszaen0@gmail.com")
  assert.equal(entries.length, 1)
  assert.deepEqual(entries[0].lines, ["akun per project", "- Life-hub : triaszulfa9@gmail.com", "* linktree : iaszaen0@gmail.com", "1. portfolio : iaszaen0@gmail.com"])
})

test("lines before any title are reported as skipped; links don't start notes", () => {
  const { entries, skipped } = parseNotesFile("﻿daftar akun saya\nhttps://example.com\n\nvercel : c@x.com\nhttps://vercel.com/dashboard")
  assert.deepEqual(skipped, [{ line: 1, text: "daftar akun saya" }, { line: 2, text: "https://example.com" }])
  assert.deepEqual(entries, [{ title: "vercel", lines: ["c@x.com", "https://vercel.com/dashboard"] }])
})

test("the same title twice in one file becomes one note", () => {
  const { entries } = parseNotesFile("Supabase : a@x.com\n\nsupabase : b@x.com")
  assert.deepEqual(entries, [{ title: "Supabase", lines: ["a@x.com", "b@x.com"] }])
})

test("entry HTML escapes text and turns list lines into lists", () => {
  assert.equal(
    entryHtml({ title: "t", lines: ["<b>akun</b> & co", "- Life-hub : a@x.com", "- linktree : b@x.com", "1. first", "after"] }),
    "<p>&lt;b&gt;akun&lt;/b&gt; &amp; co</p><ul><li><p>Life-hub : a@x.com</p></li><li><p>linktree : b@x.com</p></li></ul><ol><li><p>first</p></li></ol><p>after</p>",
  )
})

test("limits are 200 KB and 100 notes", () => {
  assert.deepEqual(IMPORT_LIMITS, { bytes: 200 * 1024, entries: 100 })
})
