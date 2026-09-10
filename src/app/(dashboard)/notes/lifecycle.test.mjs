import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("../../../components/notes-workspace.tsx", import.meta.url),
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

test("notes page exposes restore and permanent delete controls", () => {
  assert.match(page, /restoreNote=\{restoreNote\}/);
  assert.match(page, /deleteNotePermanently=\{deleteNotePermanently\}/);
  assert.match(workspace, />Restore<\/button>/);
  assert.match(workspace, />Delete permanently<\/button>/);
});
