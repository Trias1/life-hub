import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8")
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
const detailPage = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8")
const detail = readFileSync(new URL("../../../components/task-details.tsx", import.meta.url), "utf8")
const policies = readFileSync(new URL("../../../../supabase/migrations/0024_note_task_delete_policies.sql", import.meta.url), "utf8")

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}(`)
  const end = nextName ? actions.indexOf(`export async function ${nextName}(`, start) : actions.length
  assert.notEqual(start, -1, `${name} action is missing`)
  return actions.slice(start, end === -1 ? actions.length : end)
}

test("active tasks support validated editing and soft deletion", () => {
  assert.match(actionSource("updateTask", "trashTask"), /description: encryptField\(FIELD\.TASK_DESCRIPTION, input\.data\.description\)/)
  assert.match(actionSource("trashTask", "restoreTask"), /deleted_at: now/)
  assert.match(actionSource("restoreTask", "deleteTaskPermanently"), /deleted_at: null/)
})

test("permanent task deletion is creator-scoped through RLS", () => {
  const source = actionSource("deleteTaskPermanently", "createTaskLabel")
  assert.match(source, /task\.created_by !== context\.user\.id/)
  assert.match(source, /context\.supabase\.from\("tasks"\)\.delete\(\)/)
  assert.match(source, /eq\("workspace_id", context\.workspaceId\)\.eq\("created_by", context\.user\.id\)/)
  assert.match(source, /redirect\("\/tasks\?view=trash/)
  assert.match(policies, /creators can delete tasks/)
  assert.match(policies, /deleted_at is not null/)
  assert.match(policies, /workspace_members/)
})

test("creating a task opens the new task instead of the list", () => {
  const source = actionSource("createTask", "updateTaskStatus")
  assert.match(source, /redirect\("\/tasks\/" \+ task\.id/)
  assert.match(source, /workspace_id: context\.workspaceId/)
  // Labels picked on the form must belong to the active workspace.
  assert.match(source, /from\("task_labels"\)\.select\("id"\)\.eq\("workspace_id", context\.workspaceId\)/)
})

test("task mutations stay scoped to the active workspace", () => {
  for (const [name, next] of [["updateTaskStatus", "updateTask"], ["updateTask", "trashTask"], ["trashTask", "restoreTask"], ["restoreTask", "deleteTaskPermanently"], ["assignTask", "toggleTaskLabel"]]) {
    assert.match(actionSource(name, next), /eq\("workspace_id", context\.workspaceId\)/, name)
  }
})

test("tasks list exposes open, closed, all and trash views and redirects old links", () => {
  assert.match(page, /\["trash", "Trash"\]/)
  assert.match(page, /action=\{restoreTask\}/)
  assert.match(page, /redirect\("\/tasks\/" \+ params\.task\)/)
  assert.match(page, /TaskBoard/)
})

test("task detail page exposes restore and permanent delete controls", () => {
  assert.match(detailPage, /\brestoreTask\b/)
  assert.match(detailPage, /\bdeleteTaskPermanently\b/)
  assert.match(detail, /action=\{actions\.restoreTask\}/)
  assert.match(detail, /action=\{actions\.deleteTaskPermanently\}/)
  assert.match(detail, />Delete permanently<\/button>/)
})

test("task description and comments are encrypted at rest", () => {
  assert.equal((actions.match(/description: encryptField\(FIELD\.TASK_DESCRIPTION, input\.data\.description\)/g) ?? []).length, 2)
  assert.match(actions, /body: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(4000\)/)
  assert.match(actions, /const body = encryptField\(FIELD\.TASK_COMMENT_BODY, input\.data\.body\)/)
  assert.match(actions, /if \(body\.length > 12000\) actionFailure\(back, "add task comment"\)/)
  assert.match(detailPage, /decryptField\(FIELD\.TASK_DESCRIPTION, task\.description\)/)
  assert.match(detailPage, /decryptField\(FIELD\.TASK_COMMENT_BODY, comment\.body\)/)
  assert.match(detail, /maxLength=\{4000\} name="body"/)
})

test("checklist item titles are encrypted at rest", () => {
  assert.match(actions, /const title = encryptField\(FIELD\.CHECKLIST_TITLE, input\.data\.title\)/)
  assert.match(actions, /if \(title\.length > 2000\) actionFailure\(back, "create checklist item"\)/)
  assert.match(detailPage, /decryptField\(FIELD\.CHECKLIST_TITLE, item\.title\)/)
})
