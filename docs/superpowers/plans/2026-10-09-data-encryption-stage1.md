# Data Encryption Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt free-text user content (note bodies and versions, task descriptions and comments, event descriptions, profile bio, space descriptions) at the application layer before it reaches Supabase.

**Architecture:** One server-only module, `src/lib/data-crypto.mjs`, provides `encryptField` and `decryptField` (AES-256-GCM, with the field family as AAD and a key id for rotation). Every write site wraps the value after Zod validation. Every read site decrypts before data reaches a client component. Writes are gated by `DATA_ENCRYPTION_WRITE=on`. Reads always decrypt values prefixed `enc:1:` and pass legacy plaintext through unchanged.

**Tech Stack:** Next.js 16 server actions and route handlers, Supabase JS, `node:crypto`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-09-data-encryption-stage1-design.md`

## Global Constraints

- No database migrations or schema changes.
- Env: `DATA_ENCRYPTION_KEY` (base64, exactly 32 bytes); optional `DATA_ENCRYPTION_KEY_PREVIOUS`; `DATA_ENCRYPTION_WRITE=on` enables encrypted writes.
- Stored format: `enc:1:<kid>:<iv>:<tag>:<ciphertext>`, base64url parts, `kid` = first 8 hex chars of `sha256(key)`.
- Field families: `note.content`, `task.description`, `task_comment.body`, `event.description`, `profile.bio`, `space.description`.
- Zod limits keep validating plaintext. The task comment limit drops from 4000 to 2500. A comment whose ciphertext exceeds 4000 characters is rejected.
- Ciphertext must never be passed to a client component. Plaintext and key material must never appear in logs or error messages.
- Decryption failure throws `DataCryptoError`. The page errors instead of rendering empty content, so an edit can never overwrite encrypted data with blanks.
- Repo is public: no key values in git. `.env*` is already ignored.
- Run all commands from `D:\project-pribadi\life-hub\lifehub-app` on branch `staging`.

## Review Focus

- Note restored from a version written before encryption existed (plaintext version restored into an encrypted note): content restores correctly, and the next save encrypts it. Covered by the Task 1 legacy test plus the Task 2 restore path, which decrypts before re-saving.
- Saving a note whose content did not change: no new version row, and no "changed" false positive from comparing ciphertext with plaintext. Task 2 compares decrypted values.
- Indonesian text, emoji and HTML in content round-trip byte-exact. Task 1 multi-byte test.
- Write switch off while values are already encrypted: still readable, and new writes are plaintext. Task 1 "writes off" test.
- A comment just under 2500 characters made of 4-byte emoji: rejected cleanly, not with a database CHECK error. Task 3 guard.

## File Structure

| File | Responsibility |
|---|---|
| Create `src/lib/data-crypto.mjs` | Field encryption and decryption, key loading, rotation, write switch |
| Create `src/lib/data-crypto.test.mjs` | Unit tests for the module |
| Modify `src/app/(dashboard)/notes/actions.ts` | Encrypt on create and update; compare and restore on plaintext |
| Modify `src/app/(dashboard)/notes/[id]/page.tsx` | Decrypt `note.content` |
| Modify `src/app/(dashboard)/notes/page.tsx` | Stop selecting the unused `content` |
| Modify `src/app/(dashboard)/tasks/actions.ts` | Encrypt description and comment; comment limit and guard |
| Modify `src/app/(dashboard)/tasks/[id]/page.tsx` | Decrypt description and comments |
| Modify `src/components/task-details.tsx` | Textarea `maxLength` 2500 |
| Modify `src/app/(dashboard)/calendar/actions.ts` | Encrypt description |
| Modify `src/app/(dashboard)/calendar/[id]/page.tsx` | Decrypt description |
| Modify `src/app/(dashboard)/settings/actions.ts` | Encrypt bio |
| Modify `src/app/(dashboard)/profile/page.tsx` | Decrypt bio |
| Modify `src/app/(dashboard)/_actions/spaces.ts` | Encrypt description |
| Modify `src/app/api/workspace/export/route.ts` | Decrypt encrypted families in the export |
| Modify `scripts/self-check.mjs` | Assert that every site uses the helpers |

Left unchanged on purpose:

- `calendar/page.tsx` and `api/calendar/reminders/route.ts` select `description` but never send or use it. Ciphertext stays server-side, so no change is needed. This is a refinement of the spec, which suggested dropping the column from the reminders select.

---

### Task 1: Crypto module

**Files:**
- Create: `src/lib/data-crypto.mjs`
- Test: `src/lib/data-crypto.test.mjs`

**Interfaces:**
- Produces:
  - `encryptField(family: string, plaintext: string): string`
  - `decryptField(family: string, stored: string | null | undefined): string`
  - `isEncrypted(stored: unknown): boolean`
  - `class DataCryptoError extends Error`
  - `FIELD` (frozen object: `NOTE_CONTENT`, `TASK_DESCRIPTION`, `TASK_COMMENT_BODY`, `EVENT_DESCRIPTION`, `PROFILE_BIO`, `SPACE_DESCRIPTION`)
- All functions read `process.env` on each call, so tests can change env between cases.

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/data-crypto.test.mjs
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import test from "node:test"
import { DataCryptoError, FIELD, decryptField, encryptField, isEncrypted } from "./data-crypto.mjs"

const keyA = randomBytes(32).toString("base64")
const keyB = randomBytes(32).toString("base64")
function env(values) {
  for (const name of ["DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY_PREVIOUS", "DATA_ENCRYPTION_WRITE"]) delete process.env[name]
  Object.assign(process.env, values)
}

test("round-trips text, including empty, multi-byte and HTML", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  for (const text of ["", "Halo dunia", "Kopi ☕ 🚀 — ünïcödé", "<p>a &amp; b</p>"]) {
    const stored = encryptField(FIELD.NOTE_CONTENT, text)
    assert.ok(stored.startsWith("enc:1:"))
    assert.notEqual(stored, text)
    assert.equal(decryptField(FIELD.NOTE_CONTENT, stored), text)
  }
})

test("each encryption uses a fresh IV", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  assert.notEqual(encryptField(FIELD.PROFILE_BIO, "same"), encryptField(FIELD.PROFILE_BIO, "same"))
})

test("legacy plaintext and empty values pass through", () => {
  env({ DATA_ENCRYPTION_KEY: keyA })
  assert.equal(decryptField(FIELD.NOTE_CONTENT, "plain old note"), "plain old note")
  assert.equal(decryptField(FIELD.NOTE_CONTENT, null), "")
  assert.equal(decryptField(FIELD.NOTE_CONTENT, undefined), "")
})

test("writes stay plaintext when the switch is off, but encrypted values still read", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.TASK_DESCRIPTION, "secret")
  env({ DATA_ENCRYPTION_KEY: keyA })
  assert.equal(encryptField(FIELD.TASK_DESCRIPTION, "new text"), "new text")
  assert.equal(decryptField(FIELD.TASK_DESCRIPTION, stored), "secret")
})

test("rejects tampering in iv, tag or ciphertext", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const parts = encryptField(FIELD.NOTE_CONTENT, "do not touch").split(":")
  for (const index of [3, 4, 5]) {
    const copy = [...parts]
    const bytes = Buffer.from(copy[index], "base64url")
    bytes[0] ^= 1
    copy[index] = bytes.toString("base64url")
    assert.throws(() => decryptField(FIELD.NOTE_CONTENT, copy.join(":")), DataCryptoError)
  }
})

test("a value cannot be decrypted as another field family", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.PROFILE_BIO, "bio")
  assert.throws(() => decryptField(FIELD.NOTE_CONTENT, stored), DataCryptoError)
})

test("rotation: previous key still decrypts, unknown key id is rejected", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const oldValue = encryptField(FIELD.NOTE_CONTENT, "old")
  env({ DATA_ENCRYPTION_KEY: keyB, DATA_ENCRYPTION_KEY_PREVIOUS: keyA })
  assert.equal(decryptField(FIELD.NOTE_CONTENT, oldValue), "old")
  env({ DATA_ENCRYPTION_KEY: keyB })
  assert.throws(() => decryptField(FIELD.NOTE_CONTENT, oldValue), DataCryptoError)
})

test("missing or malformed key fails without leaking the value", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.NOTE_CONTENT, "top secret")
  env({})
  assert.throws(() => decryptField(FIELD.NOTE_CONTENT, stored), (error) => error instanceof DataCryptoError && !error.message.includes("top secret"))
  env({ DATA_ENCRYPTION_KEY: "c2hvcnQ=", DATA_ENCRYPTION_WRITE: "on" })
  assert.throws(() => encryptField(FIELD.NOTE_CONTENT, "x"), DataCryptoError)
})

test("unknown field family is rejected", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  assert.throws(() => encryptField("bookmark.url", "x"), DataCryptoError)
})

test("isEncrypted recognises only the stored prefix", () => {
  assert.equal(isEncrypted("enc:1:abcd"), true)
  assert.equal(isEncrypted("encrypted text"), false)
  assert.equal(isEncrypted(null), false)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test src/lib/data-crypto.test.mjs`
Expected: FAIL, `Cannot find module ... data-crypto.mjs`.

- [ ] **Step 3: Implement the module**

```js
// src/lib/data-crypto.mjs
// Server-only: imports node:crypto and reads secret env vars, so it cannot be bundled for the browser.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const PREFIX = "enc:1:"

export const FIELD = Object.freeze({
  NOTE_CONTENT: "note.content",
  TASK_DESCRIPTION: "task.description",
  TASK_COMMENT_BODY: "task_comment.body",
  EVENT_DESCRIPTION: "event.description",
  PROFILE_BIO: "profile.bio",
  SPACE_DESCRIPTION: "space.description",
})
const families = new Set(Object.values(FIELD))

export class DataCryptoError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = "DataCryptoError"
  }
}

/** @param {string | undefined} value */
function loadKey(value) {
  if (!value) return null
  const key = Buffer.from(value, "base64")
  if (key.length !== 32) throw new DataCryptoError("Data encryption key must be 32 bytes")
  return { key, kid: createHash("sha256").update(key).digest("hex").slice(0, 8) }
}

function keys() {
  return [loadKey(process.env.DATA_ENCRYPTION_KEY), loadKey(process.env.DATA_ENCRYPTION_KEY_PREVIOUS)].filter((entry) => entry !== null)
}

/** @param {string} family */
function assertFamily(family) {
  if (!families.has(family)) throw new DataCryptoError("Unknown encrypted field family")
}

/** @param {unknown} stored */
export function isEncrypted(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX)
}

/** Encrypts a field for storage; returns the plaintext unchanged while DATA_ENCRYPTION_WRITE is not "on". @param {string} family @param {string} plaintext */
export function encryptField(family, plaintext) {
  assertFamily(family)
  if (process.env.DATA_ENCRYPTION_WRITE !== "on") return plaintext
  const current = loadKey(process.env.DATA_ENCRYPTION_KEY)
  if (!current) throw new DataCryptoError("Data encryption key is not configured")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", current.key, iv)
  cipher.setAAD(Buffer.from(family, "utf8"))
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return PREFIX + [current.kid, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":")
}

/** Decrypts a stored field; legacy plaintext (no prefix) is returned as-is. @param {string} family @param {string | null | undefined} stored */
export function decryptField(family, stored) {
  assertFamily(family)
  if (stored === null || stored === undefined) return ""
  if (!isEncrypted(stored)) return stored
  const [kid, iv, tag, ciphertext] = stored.slice(PREFIX.length).split(":")
  if (!kid || !iv || !tag || ciphertext === undefined) throw new DataCryptoError("Malformed encrypted field")
  const match = keys().find((entry) => entry.kid === kid)
  if (!match) throw new DataCryptoError("No key available for encrypted field")
  try {
    const decipher = createDecipheriv("aes-256-gcm", match.key, Buffer.from(iv, "base64url"))
    decipher.setAAD(Buffer.from(family, "utf8"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    throw new DataCryptoError("Encrypted field failed authentication")
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `node --test src/lib/data-crypto.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-crypto.mjs src/lib/data-crypto.test.mjs
git commit -m "feat: add field-level encryption helper"
```

### Task 2: Notes

**Files:**
- Modify: `src/app/(dashboard)/notes/actions.ts` (lines 7, 25, 39-59, 68-74)
- Modify: `src/app/(dashboard)/notes/[id]/page.tsx` (lines 17-23, 47)
- Modify: `src/app/(dashboard)/notes/page.tsx:35`
- Test: `src/app/(dashboard)/notes/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `encryptField`, `decryptField` and `FIELD.NOTE_CONTENT` from Task 1.

- [ ] **Step 1: Add the failing source assertions** to `notes/lifecycle.test.mjs`. It already reads `actions` and `page` (`[id]/page.tsx`):

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "src/app/(dashboard)/notes/lifecycle.test.mjs"`
Expected: FAIL on the new test only.

- [ ] **Step 3: Implement**

In `actions.ts`, add the import after line 7:

```ts
import { FIELD, decryptField, encryptField } from "@/lib/data-crypto.mjs"
```

Line 25, in the insert object, replace `content: input.data.content` with:

```ts
content: encryptField(FIELD.NOTE_CONTENT, input.data.content)
```

Replace lines 43-47:

```ts
  const oldContent = decryptField(FIELD.NOTE_CONTENT, note.content)
  const textChanged = note.title !== input.data.title || oldContent !== input.data.content
  const detailsChanged = folder !== note.folder || JSON.stringify(tags) !== JSON.stringify(note.tags)
  if (!textChanged && !detailsChanged) return { title: note.title, content: oldContent }

  const { error: updateError } = await context.supabase.from("notes").update({ title: input.data.title, content: encryptField(FIELD.NOTE_CONTENT, input.data.content), folder, tags, updated_at: new Date().toISOString() }).eq("id", note.id).eq("author_id", context.user.id)
```

Line 54 stays as is: it copies the stored `note.content`. The version and the note share the `note.content` family, so the stored value is valid in either table.

Line 73 becomes:

```ts
  data.set("content", decryptField(FIELD.NOTE_CONTENT, version.content))
```

In `[id]/page.tsx`, add after line 3:

```ts
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"
```

Then, after `if (!note) notFound()`, add:

```ts
  const content = decryptField(FIELD.NOTE_CONTENT, note.content)
```

Change line 47 to:

```tsx
note={{ ...note, content, tags: note.tags ?? [] }}
```

In `notes/page.tsx:35`, remove `content,` from the select string. The list never displays content.

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test "src/app/(dashboard)/notes/lifecycle.test.mjs"` then `npx tsc --noEmit`
Expected: PASS, and tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/notes"
git commit -m "feat: encrypt note content at rest"
```

### Task 3: Tasks (description and comments)

**Files:**
- Modify: `src/app/(dashboard)/tasks/actions.ts` (lines 7, 40, 72, 200-203)
- Modify: `src/app/(dashboard)/tasks/[id]/page.tsx` (lines 36, 64, 80)
- Modify: `src/components/task-details.tsx:312`
- Test: `src/app/(dashboard)/tasks/lifecycle.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports, plus `FIELD.TASK_DESCRIPTION` and `FIELD.TASK_COMMENT_BODY`.

- [ ] **Step 1: Add the failing assertions** to `tasks/lifecycle.test.mjs`. It already reads `actions`, `detailPage` (`[id]/page.tsx`) and `detail` (`components/task-details.tsx`):

```js
test("task description and comments are encrypted at rest", () => {
  assert.equal((actions.match(/description: encryptField\(FIELD\.TASK_DESCRIPTION, input\.data\.description\)/g) ?? []).length, 2)
  assert.match(actions, /body: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(2500\)/)
  assert.match(actions, /const body = encryptField\(FIELD\.TASK_COMMENT_BODY, input\.data\.body\)/)
  assert.match(actions, /if \(body\.length > 4000\) actionFailure\(back, "add task comment"\)/)
  assert.match(detailPage, /decryptField\(FIELD\.TASK_DESCRIPTION, task\.description\)/)
  assert.match(detailPage, /decryptField\(FIELD\.TASK_COMMENT_BODY, comment\.body\)/)
  assert.match(detail, /maxLength=\{2500\}/)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "src/app/(dashboard)/tasks/lifecycle.test.mjs"`
Expected: FAIL on the new test.

- [ ] **Step 3: Implement**

In `actions.ts`, add after line 7:

```ts
import { FIELD, encryptField } from "@/lib/data-crypto.mjs"
```

On line 40 and line 72, replace `description: input.data.description` with:

```ts
description: encryptField(FIELD.TASK_DESCRIPTION, input.data.description)
```

Replace lines 200-203:

```ts
  const input = z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(2500) }).safeParse({ taskId: formData.get("taskId"), body: formData.get("body") })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "add task comment")
  const { context, back } = await getTaskContext(formData, "add task comment")
  // task_comments.body has a 4000-character CHECK; ciphertext is longer than the text, so refuse before the database does.
  const body = encryptField(FIELD.TASK_COMMENT_BODY, input.data.body)
  if (body.length > 4000) actionFailure(back, "add task comment")
  const { error } = await context.supabase.from("task_comments").insert({ task_id: input.data.taskId, author_id: context.user.id, body })
```

In `[id]/page.tsx`, add the import:

```ts
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"
```

After `if (!task) notFound()` add:

```ts
  const description = decryptField(FIELD.TASK_DESCRIPTION, task.description)
```

On line 64, change `text: comment.body` to:

```ts
text: decryptField(FIELD.TASK_COMMENT_BODY, comment.body)
```

On line 80, change `description: task.description ?? ""` to `description`.

In `task-details.tsx:312`, change `maxLength={4000}` to `maxLength={2500}`.

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test "src/app/(dashboard)/tasks/lifecycle.test.mjs"` then `npx tsc --noEmit`
Expected: PASS, and tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/tasks" src/components/task-details.tsx
git commit -m "feat: encrypt task descriptions and comments at rest"
```

### Task 4: Calendar, profile bio and spaces

**Files:**
- Modify: `src/app/(dashboard)/calendar/actions.ts` (lines 7, 32, 49)
- Modify: `src/app/(dashboard)/calendar/[id]/page.tsx` (lines 31, 60)
- Modify: `src/app/(dashboard)/settings/actions.ts` (lines 10, 44)
- Modify: `src/app/(dashboard)/profile/page.tsx` (lines 13, 23)
- Modify: `src/app/(dashboard)/_actions/spaces.ts` (lines 7, 17, 41)
- Test: `src/app/(dashboard)/calendar/lifecycle.test.mjs`, plus a new `src/app/(dashboard)/profile/profile-crypto.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports, plus `FIELD.EVENT_DESCRIPTION`, `FIELD.PROFILE_BIO` and `FIELD.SPACE_DESCRIPTION`.

- [ ] **Step 1: Write the failing assertions**

Append to `calendar/lifecycle.test.mjs`. It already reads `actions` and `detailPage` (`[id]/page.tsx`):

```js
test("event descriptions are encrypted at rest", () => {
  assert.equal((actions.match(/description: encryptField\(FIELD\.EVENT_DESCRIPTION, input\.data\.description\)/g) ?? []).length, 2)
  assert.match(detailPage, /decryptField\(FIELD\.EVENT_DESCRIPTION, event\.description\)/)
})
```

Create `src/app/(dashboard)/profile/profile-crypto.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const settingsActions = readFileSync(new URL("../settings/actions.ts", import.meta.url), "utf8")
const profilePage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
const spaces = readFileSync(new URL("../_actions/spaces.ts", import.meta.url), "utf8")

test("profile bio and space descriptions are encrypted at rest", () => {
  assert.match(settingsActions, /bio: encryptField\(FIELD\.PROFILE_BIO, input\.data\.bio\)/)
  assert.match(profilePage, /decryptField\(FIELD\.PROFILE_BIO, profile\.bio\)/)
  assert.equal((spaces.match(/description: encryptField\(FIELD\.SPACE_DESCRIPTION, input\.data\.description\)/g) ?? []).length, 2)
  assert.doesNotMatch(spaces, /\.\.\.input\.data/)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "src/app/(dashboard)/calendar/lifecycle.test.mjs" "src/app/(dashboard)/profile/profile-crypto.test.mjs"`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement**

**calendar/actions.ts:**
- Import `{ FIELD, encryptField }` from `"@/lib/data-crypto.mjs"`.
- On lines 32 and 49, replace `description: input.data.description` with:

```ts
description: encryptField(FIELD.EVENT_DESCRIPTION, input.data.description)
```

**calendar/[id]/page.tsx:**
- Import `{ FIELD, decryptField }`.
- After `if (!event) notFound()` add:

```ts
  const description = decryptField(FIELD.EVENT_DESCRIPTION, event.description)
```

- On line 60, change `description: event.description ?? ""` to `description`.

**settings/actions.ts:**
- Import `{ FIELD, encryptField }`.
- On line 44, change `bio: input.data.bio` to:

```ts
bio: encryptField(FIELD.PROFILE_BIO, input.data.bio)
```

**profile/page.tsx:**
- Import `{ FIELD, decryptField }`.
- After line 13 add:

```ts
  const profileView = profile ? { ...profile, bio: decryptField(FIELD.PROFILE_BIO, profile.bio) } : profile
```

- On line 23, pass `profile={profileView}`.

**_actions/spaces.ts:**
- Import `{ FIELD, encryptField }`.
- Replace the line-17 insert with explicit fields:

```ts
  const { data: space, error } = await context.supabase.from("spaces").insert({ name: input.data.name, color: input.data.color, icon: input.data.icon, description: encryptField(FIELD.SPACE_DESCRIPTION, input.data.description), workspace_id: context.workspaceId, creator_id: context.user.id }).select("id").single()
```

- On line 41, replace `description: input.data.description` with:

```ts
description: encryptField(FIELD.SPACE_DESCRIPTION, input.data.description)
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test "src/app/(dashboard)/calendar/lifecycle.test.mjs" "src/app/(dashboard)/profile/profile-crypto.test.mjs"` then `npx tsc --noEmit`
Expected: PASS, and tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/calendar" "src/app/(dashboard)/settings/actions.ts" "src/app/(dashboard)/profile" "src/app/(dashboard)/_actions/spaces.ts"
git commit -m "feat: encrypt event descriptions, profile bio and space descriptions"
```

### Task 5: Workspace export, self-check and full verification

**Files:**
- Modify: `src/app/api/workspace/export/route.ts:27`
- Modify: `scripts/self-check.mjs`

**Interfaces:**
- Consumes: `decryptField` and `FIELD` from Task 1.

- [ ] **Step 1: Add the failing self-check assertions**

Append to `scripts/self-check.mjs` before its final success log, matching its existing `assert` style:

```js
const exportRoute = readFileSync(new URL("../src/app/api/workspace/export/route.ts", import.meta.url), "utf8")
for (const family of ["NOTE_CONTENT", "TASK_DESCRIPTION", "EVENT_DESCRIPTION", "SPACE_DESCRIPTION"]) {
  assert.match(exportRoute, new RegExp("FIELD\\." + family), "export must decrypt " + family)
}
```

- [ ] **Step 2: Run the self-check and confirm it fails**

Run: `npm run self-check`
Expected: FAIL with "export must decrypt NOTE_CONTENT".

- [ ] **Step 3: Implement the export decryption**

In `export/route.ts`, add:

```ts
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"

const encryptedColumns: Record<string, Array<[string, string]>> = {
  spaces: [["description", FIELD.SPACE_DESCRIPTION]],
  notes: [["content", FIELD.NOTE_CONTENT]],
  tasks: [["description", FIELD.TASK_DESCRIPTION]],
  calendar: [["description", FIELD.EVENT_DESCRIPTION]],
}

/** Exports stay human-readable: decrypt the encrypted columns of each exported table. */
function readable(name: string, data: unknown) {
  const columns = encryptedColumns[name]
  if (!columns || !Array.isArray(data)) return data
  return data.map((row: Record<string, unknown>) => ({ ...row, ...Object.fromEntries(columns.map(([column, family]) => [column, decryptField(family, row[column] as string | null)])) }))
}
```

Change line 27 to:

```ts
  const payload = Object.fromEntries(tables.map(([name], index) => [name, readable(name, results[index].data)]))
```

- [ ] **Step 4: Run every check**

```bash
node --test src/lib/data-crypto.test.mjs "src/app/(dashboard)/notes/lifecycle.test.mjs" "src/app/(dashboard)/tasks/lifecycle.test.mjs" "src/app/(dashboard)/calendar/lifecycle.test.mjs" "src/app/(dashboard)/profile/profile-crypto.test.mjs"
npm run self-check
npx eslint .
npx tsc --noEmit
npm run build
```

Expected:
- All tests pass.
- The self-check prints "LifeHub self-check passed".
- eslint reports 0 problems.
- tsc exits 0.
- The build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspace/export/route.ts scripts/self-check.mjs
git commit -m "feat: decrypt encrypted fields in workspace export"
```

### Task 6: Rollout (with the owner)

Pushing deploys a live site, so every push in this task needs the owner's go-ahead.

- [ ] **Step 1: Scan the branch for secrets**

Run:

```bash
git diff origin/staging --cached; git log origin/staging..HEAD -p | grep -iE "sb_secret|BEGIN [A-Z ]*KEY|DATA_ENCRYPTION_KEY=" || echo clean
```

Expected: `clean`.

- [ ] **Step 2: Push to staging**

With the owner's OK, run `git push origin staging`. The pre-push build runs automatically. Then check on the demo that notes, tasks, events and the profile still render.

- [ ] **Step 3: Fast-forward main**

With the owner's OK, run `git checkout main && git merge --ff-only staging && git push origin main`. Prod now has read support, and the write switch is still off.

- [ ] **Step 4: Turn on writes for the demo**

The owner adds `DATA_ENCRYPTION_WRITE=on` (Config) for Preview (staging). Then redeploy staging. Manual test on the demo:
- edit a note, then restore an older version;
- edit a task description and add a comment;
- edit an event description;
- edit the bio;
- export the workspace.

After the test:
- The owner confirms in the Supabase table editor that the edited rows hold `enc:1:` values.
- Open the same items on prod. Prod has the same key, so they must render. A failure here means the two keys differ.

- [ ] **Step 5: Turn on writes for prod**

The owner adds `DATA_ENCRYPTION_WRITE=on` for Production, then redeploys prod. Smoke-test prod.
