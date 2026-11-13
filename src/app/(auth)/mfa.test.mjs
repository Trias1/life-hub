import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const middleware = read("../../proxy.ts")
const authForm = read("../../components/auth/auth-form.tsx")
const challenge = read("../../components/auth/mfa-challenge-form.tsx")
const settings = read("../../components/security/two-factor-settings.tsx")
const securityCenter = read("../../components/security-center.tsx")
const migration = read("../../../supabase/migrations/0034_require_mfa_when_enrolled.sql")

test("accounts with 2FA can't use pages or the API until the code step is done", () => {
  assert.match(middleware, /needsMfa = assurance\?\.nextLevel === "aal2" && assurance\.currentLevel !== "aal2"/)
  assert.match(middleware, /if \(needsMfa && path\.startsWith\("\/api\/"\) && !path\.startsWith\("\/api\/shared\/"\)\) return reject\(401/)
  assert.match(middleware, /if \(needsMfa && \(isProtectedPath \|\| path === "\/login" \|\| path === "\/register" \|\| path === "\/"\)\) return redirectTo\("\/mfa"\)/)
  assert.match(middleware, /\(isProtectedPath \|\| path === "\/mfa"\) && !userId\) return NextResponse\.redirect\(new URL\("\/login"/)
})

test("sign-in sends 2FA accounts to the code step, which verifies a real code", () => {
  assert.match(authForm, /assurance\?\.nextLevel === "aal2" && assurance\.currentLevel !== "aal2" \? "\/mfa" : "\/dashboard"/)
  assert.match(challenge, /mfa\.challengeAndVerify\(\{ factorId, code: digits \}\)/)
})

test("removing an authenticator needs a fresh code from it first", () => {
  const removal = settings.slice(settings.indexOf("const finishRemoval"))
  assert.match(removal, /confirm\(event, removing\.id, async \(\) => \{\s*const \{ error \} = await createClient\(\)\.auth\.mfa\.unenroll/)
})

test("the Security page has no placeholder controls", () => {
  assert.doesNotMatch(securityCenter, /"tokens"|"recovery"|"devices"|ready for a configured identity/)
  assert.match(securityCenter, /section === "two-factor" \? <TwoFactorSettings \/>/)
})

test("the database enforces aal2 for enrolled accounts on every RLS table", () => {
  assert.match(migration, /coalesce\(auth\.jwt\(\) ->> 'aal', ''\) = 'aal2'/)
  assert.match(migration, /from auth\.mfa_factors f where f\.user_id = auth\.uid\(\) and f\.status = 'verified'/)
  assert.match(migration, /as restrictive for all to authenticated using \(\(select public\.mfa_requirement_met\(\)\)\)/)
  assert.match(migration, /c\.relrowsecurity/)
})

test("the invitation and workspace RPCs check the 2FA step too (0038)", () => {
  const rpc = read("../../../supabase/migrations/0038_mfa_for_rpc_functions.sql")
  for (const name of ["create_workspace", "accept_workspace_invitation", "list_my_invitations", "respond_to_my_invitation"]) {
    const wrapper = rpc.slice(rpc.indexOf("create or replace function public." + name + "("))
    assert.match(wrapper.slice(0, 600), /perform public\.require_mfa_step\(\);/, name + " checks 2FA first")
    assert.ok(rpc.includes("grant execute on function public." + name + "("), name + " stays callable by signed-in users")
  }
  assert.match(rpc, /revoke all on function public\.%I\(%s\) from public, anon, authenticated/)
  assert.match(rpc, /revoke all on function public\.ensure_workspace_membership\(\) from public, anon, authenticated;/)
  assert.doesNotMatch(rpc, /function public.consume_request_rate_limit/, "the limiter stays usable at aal1 (recovery codes)")
})
