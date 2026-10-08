import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8")
const migration = readFileSync(new URL("../../../../supabase/migrations/0029_invitee_inbox.sql", import.meta.url), "utf8")
const banner = readFileSync(new URL("../../../components/invitation-banner.tsx", import.meta.url), "utf8")
const buttons = readFileSync(new URL("../../../components/invitation-response-buttons.tsx", import.meta.url), "utf8")

test("answering an invitation goes through the database function, not a client-side insert", () => {
  assert.match(actions, /rpc\("respond_to_my_invitation"/)
  assert.doesNotMatch(actions, /from\("workspace_members"\)/)
  assert.doesNotMatch(actions, /createAdminClient/)
})

test("redirect targets are a fixed allow-list", () => {
  assert.match(actions, /returnTo: z\.enum\(\["\/invites", "\/dashboard", "\/onboarding"\]\)/)
})

test("answering by id requires a confirmed email that matches the invitation", () => {
  assert.match(migration, /email_confirmed_at is not null/)
  assert.match(migration, /lower\(invitation\.email\) <> confirmed_email/)
  assert.match(migration, /accepted_at is null and declined_at is null and expires_at > now\(\)/)
})

test("declined invitations cannot be accepted through the emailed link either", () => {
  const linkFlow = migration.slice(migration.indexOf("function public.accept_workspace_invitation"))
  assert.match(linkFlow, /declined_at is null/)
})

test("the banner offers both answers and locks them while submitting", () => {
  assert.match(banner, /<InvitationResponseButtons \/>/)
  assert.match(buttons, /disabled=\{pending\}/)
  assert.match(buttons, /value="accept"/)
  assert.match(buttons, /value="decline"/)
})
