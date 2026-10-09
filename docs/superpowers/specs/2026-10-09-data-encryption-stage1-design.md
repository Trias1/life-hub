# Data encryption at rest — Stage 1 (server-side field encryption)

Date: 2026-10-09 · Status: draft for owner review

## Goal

Free-text user content stays unreadable to anyone who can read the database but not the
application's secrets: a leaked `SUPABASE_SECRET_KEY`, a database dump, or someone browsing the
Supabase table editor. The app keeps working exactly as before for signed-in users.

This is stage 1 of 3:

1. **Stage 1 (this spec):** server-side encryption of free-text columns.
2. Stage 2: encrypt file contents before they are uploaded to Google Drive.
3. Stage 3: passphrase-locked items, encrypted in the browser.

## Constraints

- **No database changes in stage 1.** No migrations, no new columns. The Supabase dashboard is not
  touched; schema work is deferred (see "Deferred").
- Demo (staging, Preview) and prod (main, Production) share one database. Prod must be able to read
  encrypted values before any environment starts writing them.
- Search, filters, the calendar and invitations must keep working, so anything the server queries
  on stays plaintext.
- The repo is public: no key material in git.

## Scope

### Encrypted in stage 1

| Field family (AAD) | Columns | Write sites | Read sites |
|---|---|---|---|
| `note.content` | `notes.content`, `note_versions.content` | `notes/actions.ts` create, update, version insert, restore | `notes/page.tsx`, `notes/[id]/page.tsx`, `notes/actions.ts` (compare, restore), export |
| `task.description` | `tasks.description` | `tasks/actions.ts:40`, `:72` | `tasks/[id]/page.tsx:32`, export |
| `task_comment.body` | `task_comments.body` | `tasks/actions.ts:203` | `tasks/[id]/page.tsx:43` |
| `event.description` | `calendar_events.description` | `calendar/actions.ts:32`, `:49` | `calendar/page.tsx:17`, `calendar/[id]/page.tsx:27`, export |
| `profile.bio` | `profiles.bio` | `settings/actions.ts:44` | `profile/page.tsx:13` |
| `space.description` | `spaces.description` | `_actions/spaces.ts:17`, `:41` | export |

### Deliberately plaintext

These are queried, sorted or matched by the server, or are needed to sign in: every title and name,
dates and times, task status and priority, emails, roles, tags, folders and collections,
`calendar_event_attendees.email` (equality lookups), and notification messages (they contain titles
only).

### Deferred (needs a database change, to be done when the owner is ready)

1. `task_checklist_items.title`: CHECK `char_length <= 240` is too short for ciphertext.
2. `bookmarks.url`: CHECK `url ~ '^https://'` rejects ciphertext.
3. `task_comments.body`: CHECK `<= 4000`. Until it is widened, the app caps comments at 2500
   characters and rejects any ciphertext over 4000 with a friendly error.
4. Backfill: encrypt existing plaintext rows in one pass. This is a data write rather than a schema
   change, but it is a bulk operation on live data, so it waits for the owner too.

Unused profile columns (`phone`, `website`, `location`, `job_title`, `company`) are out of scope;
nothing reads or writes them.

## Design

### Module: `src/lib/data-crypto.ts` (server-only)

```ts
type FieldFamily = "note.content" | "task.description" | "task_comment.body"
  | "event.description" | "profile.bio" | "space.description"

encryptField(family: FieldFamily, plaintext: string): string   // returns plaintext when writes are off
decryptField(family: FieldFamily, stored: string): string      // passes legacy plaintext through
isEncrypted(stored: string): boolean
```

- The file imports `server-only`, so it cannot be bundled into client code.
- **Algorithm:** AES-256-GCM with a 12-byte random IV per value. The AAD is the field family string,
  which ties a ciphertext to the kind of data it holds.
  - Notes and note versions share `note.content`, so a version can be restored by copying its
    ciphertext back into the note.
- **Key:** `DATA_ENCRYPTION_KEY`, 32 random bytes in base64. Startup validation rejects keys that do
  not decode to 32 bytes.
  - `DATA_ENCRYPTION_KEY_PREVIOUS` is optional. When it is set, decryption also tries it, so the key
    can be rotated.
- **Stored format:** `enc:1:<kid>:<iv>:<tag>:<ciphertext>`, all parts base64url.
  - `kid` is the first 8 hex characters of `sha256(key)`. It picks the right key during rotation
    without trying keys blindly.
- **Write switch:** `DATA_ENCRYPTION_WRITE=on` turns on encryption of new writes. Reads always
  decrypt values that have the `enc:` prefix.
- **Failure behaviour:**
  - A missing or unknown key, or a failed authentication tag, throws `DataCryptoError`. The error
    message never includes plaintext or key material.
  - The page shows the normal error screen rather than an empty field, so an edit can never
    overwrite encrypted data with blank text.
  - Plaintext without the prefix is returned as is, because it is legacy data.

### Call-site changes

- **Writes:** wrap the value with `encryptField(family, value)` after Zod validation, so Zod still
  checks plaintext lengths.
- **Reads:** after each query, map rows through `decryptField` before passing them to client
  components. Ciphertext never reaches the browser.
- **`updateNote`:**
  - The "did content change" check compares decrypted old content with the new plaintext.
  - The version insert copies the stored old value as is (same family, so no re-encryption).
- **`restoreNoteVersion`:** decrypts the version's content and passes the plaintext into the normal
  update path.
- **Task comments:** Zod max goes from 4000 to 2500 (textarea `maxLength` too). If the ciphertext is
  still over 4000 (possible with heavy emoji or non-Latin text), the action refuses with the
  standard "Could not add task comment" message before the database CHECK can fail.
- **`/api/workspace/export`:** decrypt the encrypted families before serialising, so the export
  stays readable for the super admin.
- **`/api/calendar/reminders` and `calendar/page.tsx`:** unchanged. They select `description` but
  never send or use it, so the ciphertext stays on the server.
- **`lib/calendar/recurrence.ts`:** receives already-decrypted rows; no change in logic.

### Rollout (shared database)

1. Generate `DATA_ENCRYPTION_KEY` into a local, git-ignored `.env.data-encryption` file. The owner
   uploads it to Vercel Production and Preview, and keeps a copy in a password manager.
   **Losing the key means losing every encrypted value.**
2. Ship read support with the write switch off: staging, then demo check, then main.
3. Set `DATA_ENCRYPTION_WRITE=on` for Preview only and redeploy staging. Test on demo, and confirm
   that the edited rows hold `enc:1:` values.
4. Set it for Production and redeploy.
5. Rollback: unset the switch and redeploy. Already-encrypted values stay readable while the key
   exists.

## Testing

- **Unit tests (`src/lib/data-crypto.test.mjs`, node test runner, like the existing `*.test.mjs`):**
  - round trip, including empty strings and multi-byte text;
  - legacy plaintext passes through;
  - a tampered ciphertext, IV or tag is rejected;
  - the wrong family (AAD) is rejected;
  - an unknown `kid` is rejected;
  - a value written with the previous key still decrypts after rotation;
  - writes are skipped when the switch is off;
  - invalid key length is rejected.
- **Self-check:** `scripts/self-check.mjs` asserts that every listed write site calls
  `encryptField`, and that the read pages import `decryptField`.
- **Existing checks:** `npm run lint`, `npm run typecheck` and `npm run self-check`, plus the
  pre-push `npm run build`.
- **Manual on demo, after step 3:**
  - create and edit a note, then restore an older version;
  - edit a task description and add a comment;
  - create an event with a description and open the detail page;
  - edit the bio;
  - export the workspace;
  - check that prod still shows all of the above correctly.

## Out of scope for stage 1

- Titles, names and other queried fields.
- File contents and images (stage 2).
- Browser-side drafts in `localStorage`, and passphrase locking (stage 3).
- Database migrations and the backfill (deferred list above).
