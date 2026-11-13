import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n")
const actions = read("./actions.ts")
const page = read("./[id]/page.tsx")
const list = read("./page.tsx")
const detail = read("../../../components/notes/note-detail.tsx")
const pages = read("../../../components/notes/note-pages.tsx")
const toc = read("../../../components/notes/note-toc.tsx")
const migration = read("../../../../supabase/migrations/0035_note_subpages.sql")

const actionSource = (name) => {
  const start = actions.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, name + " is missing")
  const end = actions.indexOf("\nexport async function ", start + 1)
  return actions.slice(start, end === -1 ? actions.length : end)
}

test("the database keeps the page tree inside one workspace and one author, without cycles", () => {
  assert.match(migration, /foreign key \(parent_id, workspace_id\)\s+references public\.notes \(id, workspace_id\) on delete set null \(parent_id\)/)
  assert.match(migration, /parent_author <> new\.author_id/)
  assert.match(migration, /if ancestor = new\.id then/)
  assert.match(migration, /before insert or update of parent_id, author_id, workspace_id on public\.notes/)
  // Runs as the caller, so the parent lookup goes through RLS.
  assert.doesNotMatch(migration, /^\s*security definer\s*$/im)
})

test("sub-pages are only created under your own active notes", () => {
  const source = actionSource("createNote")
  assert.match(source, /findOwnActiveNote\(context, parentId\.data\)/)
  assert.match(source, /parent_id: parent\?\.id \?\? null/)
  const finder = actions.slice(actions.indexOf("async function findOwnActiveNote"))
  assert.match(finder, /\.eq\("workspace_id", context\.workspaceId\)\.eq\("author_id", context\.user\.id\)\.is\("deleted_at", null\)\.is\("archived_at", null\)/)
})

test("moving a note checks the new parent and refuses its own sub-pages", () => {
  const source = actionSource("updateNote")
  assert.match(source, /findOwnActiveNote\(context, parentId\)/)
  assert.match(source, /\(await ownSubtree\(context, note\.id\)\)\.includes\(parentId\)/)
  assert.match(source, /parent_id: parentId/)
})

test("archive, trash, restore and delete act on the page and its sub-pages, scoped to the author", () => {
  for (const name of ["archiveNote", "trashNote", "deleteNotePermanently"]) {
    const source = actionSource(name)
    assert.match(source, /ownSubtree\(context, /, name)
    assert.match(source, /\.in\("id", ids\)\.eq\("workspace_id", context\.workspaceId\)\.eq\("author_id", context\.user\.id\)/, name)
  }
  assert.match(actionSource("deleteNotePermanently"), /\.not\("deleted_at", "is", null\)/)
  const restore = actionSource("restoreNote")
  assert.match(restore, /\.in\("id", subPages\)\.eq\("workspace_id", context\.workspaceId\)\.eq\("author_id", context\.user\.id\)/)
  assert.match(restore, /update\(\{ parent_id: null \}\)/)
  const subtree = actions.slice(actions.indexOf("async function ownSubtree"))
  assert.match(subtree, /\.eq\("workspace_id", context\.workspaceId\)\.eq\("author_id", context\.user\.id\)/)
})

test("the note page shows pages, parent and contents without loading other notes' content", () => {
  assert.match(page, /from\("notes"\)\.select\("id,title,parent_id,author_id"\)\.eq\("workspace_id", context\.workspaceId\)\.is\("deleted_at", null\)\.is\("archived_at", null\)/)
  assert.match(page, /row\.author_id === context\.user\.id && !ownSubtree\.has\(row\.id\)/)
  assert.match(detail, /<NotePages pages=\{pages\} currentId=\{note\.id\}/)
  assert.match(detail, /formData\.set\("parentId", draft\.parentId\)/)
  assert.match(pages, /<input type="hidden" name="parentId" value=\{currentId\} \/>/)
  assert.doesNotMatch(toc, /innerHTML|setAttribute\("id"/)
})

test("the notes list nests sub-pages only when nothing is filtered", () => {
  assert.match(list, /const asTree = view === "active" && !filtered/)
  assert.match(list, /<NoteList rows=\{listRows\} \/>/)
})
