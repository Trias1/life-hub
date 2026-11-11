import assert from "node:assert/strict"
import test from "node:test"
import { accountInitials, groupByValue, parseKeyValue, splitNoteDoc } from "./note-blocks.mjs"

const item = (text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
const list = (...texts) => ({ type: "bulletList", content: texts.map(item) })
const paragraph = (text) => ({ type: "paragraph", content: [{ type: "text", text }] })

test("reads label : value lines, ignoring the colon in links", () => {
  assert.deepEqual(parseKeyValue("Life-hub : triaszulfa9@gmail.com"), { label: "Life-hub", value: "triaszulfa9@gmail.com" })
  assert.deepEqual(parseKeyValue("PRD Web:zaentrias4@gmail.com"), { label: "PRD Web", value: "zaentrias4@gmail.com" })
  assert.deepEqual(parseKeyValue("docs : https://supabase.com/docs"), { label: "docs", value: "https://supabase.com/docs" })
  assert.deepEqual(parseKeyValue("https://x.com : main site"), { label: "https://x.com", value: "main site" })
  assert.equal(parseKeyValue("just a sentence"), null)
  assert.equal(parseKeyValue("https://example.com/path"), null)
  assert.equal(parseKeyValue("Penyimpanan db :"), null)
  assert.equal(parseKeyValue(": no label"), null)
  assert.equal(parseKeyValue("x".repeat(61) + " : too long a label"), null)
})

test("groups labels by account, case-insensitively, in first-seen order", () => {
  const groups = groupByValue([
    { label: "Life-hub", value: "triaszulfa9@gmail.com" },
    { label: "linktree", value: "iaszaen0@gmail.com" },
    { label: "portfolio", value: "IASZAEN0@gmail.com " },
    { label: "Tiketingms", value: "drizledb" },
  ])
  assert.deepEqual(groups, [
    { value: "triaszulfa9@gmail.com", labels: ["Life-hub"] },
    { value: "iaszaen0@gmail.com", labels: ["linktree", "portfolio"] },
    { value: "drizledb", labels: ["Tiketingms"] },
  ])
})

test("initials come from the email's name part", () => {
  assert.equal(accountInitials("iaszaen0@gmail.com"), "IA")
  assert.equal(accountInitials("zaentrias4@gmail.com"), "ZA")
  assert.equal(accountInitials("drizledb"), "DR")
  assert.equal(accountInitials("@@"), "@@")
})

test("only lists where every item is label : value become account cards", () => {
  const heading = paragraph("Penyimpanan db :")
  const accounts = list("Life-hub : triaszulfa9@gmail.com", "linktree : iaszaen0@gmail.com", "portfolio : iaszaen0@gmail.com")
  const mixed = list("Life-hub : a@b.com", "remember to rotate keys")
  const segments = splitNoteDoc({ type: "doc", content: [heading, accounts, mixed, paragraph("end")] })
  assert.equal(segments.length, 3)
  assert.deepEqual(segments[0], { kind: "doc", content: [heading] })
  assert.deepEqual(segments[1], { kind: "accounts", groups: [{ value: "triaszulfa9@gmail.com", labels: ["Life-hub"] }, { value: "iaszaen0@gmail.com", labels: ["linktree", "portfolio"] }] })
  assert.deepEqual(segments[2], { kind: "doc", content: [mixed, paragraph("end")] })
})

test("nested lists and empty documents stay as normal content", () => {
  const nested = { type: "bulletList", content: [{ type: "listItem", content: [paragraph("a : b"), list("c : d")] }] }
  assert.deepEqual(splitNoteDoc({ type: "doc", content: [nested] }), [{ kind: "doc", content: [nested] }])
  assert.deepEqual(splitNoteDoc({ type: "doc", content: [] }), [])
  assert.deepEqual(splitNoteDoc(null), [])
})
