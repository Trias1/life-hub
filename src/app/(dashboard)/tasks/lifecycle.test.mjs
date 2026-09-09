import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8")
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
const policies = readFileSync(new URL("../../../../supabase/migrations/0024_note_task_delete_policies.sql", import.meta.url), "utf8")

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}(`)
  const end = nextName ? actions.indexOf(`export async function ${nextName}(`, start) : actions.length
  assert.notEqual(start, -1, `${name} action is missing`)
  return actions.slice(start, end === -1 ? actions.length : end)
}

test("active tasks support validated editing and soft deletion", () => {
  assert.match(actionSource("updateTask", "trashTask"), /description: input\.data\.description/)
  assert.match(actionSource("trashTask", "restoreTask"), /deleted_at: now/)
  assert.match(actionSource("restoreTask", "deleteTaskPermanently"), /deleted_at: null/)
})

test("permanent task deletion is creator-scoped through RLS", () => {
  const source = actionSource("deleteTaskPermanently", "getTaskContext")
  assert.match(source, /task\.created_by !== context\.user\.id/)
  assert.match(source, /context\.supabase\.from\("tasks"\)\.delete\(\)/)
  assert.match(policies, /creators can delete tasks/)
  assert.match(policies, /deleted_at is not null/)
  assert.match(policies, /workspace_members/)
})

test("tasks page exposes active and trash views", () => {
  assert.match(page, /href="\/tasks\?view=trash"/)
  assert.match(page, /action=\{restoreTask\}/)
  assert.match(page, /action=\{deleteTaskPermanently\}/)
})
