import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("../../../components/notes/note-detail.tsx", import.meta.url),
  "utf8",
);
const deletePolicies = readFileSync(
  new URL(
    "../../../../supabase/migrations/0024_note_task_delete_policies.sql",
    import.meta.url,
  ),
  "utf8",
);

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}(`);
  const end = nextName
    ? actions.indexOf(`export async function ${nextName}(`, start)
    : actions.length;
  assert.notEqual(start, -1, `${name} action is missing`);
  return actions.slice(start, end === -1 ? actions.length : end);
}

test("notes can be restored only by their creator in the active workspace", () => {
  const source = actionSource("restoreNote", "deleteNotePermanently");
  assert.match(source, /eq\(["']workspace_id["'], context\.workspaceId\)/);
  assert.match(source, /eq\(["']author_id["'], context\.user\.id\)/);
  assert.match(source, /archived_at: null, deleted_at: null/);
  assert.match(source, /revalidatePath\(["']\/notes["']\)/);
});

test("trashed notes use creator-scoped RLS for permanent deletion", () => {
  const source = actionSource("deleteNotePermanently", "toggleNoteFavorite");
  assert.match(source, /not\(["']deleted_at["'], ["']is["'], null\)/);
  assert.doesNotMatch(source, /createAdminClient\(\)/);
  assert.match(source, /context\.supabase\.from\(["']notes["']\)\.delete\(\)/);
  assert.match(source, /eq\(["']workspace_id["'], context\.workspaceId\)/);
  assert.match(source, /eq\(["']author_id["'], context\.user\.id\)/);
  assert.match(deletePolicies, /authors can delete notes/);
  assert.match(deletePolicies, /deleted_at is not null/);
  assert.match(deletePolicies, /workspace_members/);
});

test("note detail page exposes restore and permanent delete controls", () => {
  assert.match(page, /\brestoreNote\b[,\s}]/);
  assert.match(page, /\bdeleteNotePermanently\b[,\s}]/);
  assert.match(workspace, />Restore<\/button>/);
  assert.match(workspace, />Delete permanently<\/button>/);
});

test("creating a note opens the new note instead of the list", () => {
  const source = actionSource("createNote", "updateNote");
  assert.match(source, /redirect\("\/notes\/" \+ note\.id/);
});

test("note edits stay scoped to the author in the active workspace", () => {
  const source = actionSource("updateNote", "restoreNoteVersion");
  assert.match(source, /eq\(["']workspace_id["'], context\.workspaceId\)/);
  assert.match(source, /eq\(["']author_id["'], context\.user\.id\)/);
});

test("note content is encrypted on write and decrypted on read", () => {
  assert.match(actions, /from "@\/lib\/data-crypto\.mjs"/)
  assert.match(actionSource("createNote", "updateNote"), /content: encryptField\(FIELD\.NOTE_CONTENT, input\.data\.content\)/)
  const update = actionSource("updateNote", "restoreNoteVersion")
  assert.match(update, /const oldContent = decryptField\(FIELD\.NOTE_CONTENT, note\.content\)/)
  assert.match(update, /oldContent !== input\.data\.content/)
  assert.match(update, /content: encryptField\(FIELD\.NOTE_CONTENT, input\.data\.content\)/)
  assert.match(actionSource("restoreNoteVersion", "archiveNote"), /decryptField\(FIELD\.NOTE_CONTENT, version\.content\)/)
  assert.match(page, /decryptField\(FIELD\.NOTE_CONTENT, note\.content\)/)
})

test("importing notes re-reads the file on the server and only appends to your own notes", () => {
  const source = actions.slice(actions.indexOf("export async function importNotes"));
  const listPage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  const importPage = readFileSync(new URL("./import/page.tsx", import.meta.url), "utf8");
  assert.match(source, /parseNotesFile\(text\)/);
  assert.match(source, /byteLength > IMPORT_LIMITS\.bytes/);
  assert.match(source, /entries\.length > IMPORT_LIMITS\.entries/);
  assert.match(source, /\.eq\("workspace_id", context\.workspaceId\)\.eq\("author_id", context\.user\.id\)\.is\("deleted_at", null\)\.is\("archived_at", null\)/);
  assert.match(source, /from\("note_versions"\)\.insert\(\{ note_id: match\.id/);
  assert.match(source, /update\(\{ content: encryptField\(FIELD\.NOTE_CONTENT, next\)/);
  assert.match(source, /\.eq\("id", match\.id\)\.eq\("author_id", context\.user\.id\)/);
  assert.match(source, /insert\(\{ title: entry\.title, content: encryptField\(FIELD\.NOTE_CONTENT, html\)/);
  assert.match(listPage, /href="\/notes\/import"/);
  assert.match(importPage, /action=\{importNotes\}/);
});

test("account cards are shown on notes only, not on task descriptions", () => {
  const taskDetails = readFileSync(new URL("../../../components/task-details.tsx", import.meta.url), "utf8");
  const viewer = readFileSync(new URL("../../../components/notes/note-viewer.tsx", import.meta.url), "utf8");
  assert.match(workspace, /<NoteViewer content=\{note\.content\} accountCards \/>/);
  assert.doesNotMatch(taskDetails, /accountCards/);
  assert.doesNotMatch(viewer, /dangerouslySetInnerHTML/);
});
