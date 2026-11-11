import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const authForm = read("../../components/auth/auth-form.tsx")
const forgot = read("./forgot-password/page.tsx")
const securityActions = read("../(dashboard)/security/actions.ts")
const securityCenter = read("../../components/security-center.tsx")
const turnstile = read("../../components/auth/turnstile.tsx")

// With CAPTCHA on in Supabase (Attack Protection), every call below is rejected without a token,
// so a missing one means a broken sign-in, sign-up, reset or password change.
test("every Supabase Auth call that needs a CAPTCHA sends the Turnstile token", () => {
  assert.match(authForm, /signInWithPassword\(\{ email: trimmedEmail, password, options: \{ captchaToken \} \}\)/)
  assert.match(authForm, /signUp\(\{[^)]*captchaToken \} \}\)/)
  assert.match(forgot, /resetPasswordForEmail\(email, \{[\s\S]*?captchaToken,[\s\S]*?\}\)/)
  assert.match(securityActions, /signInWithPassword\(\{ email: user\.email, password: input\.data\.currentPassword, options: [^\n]*captchaToken/)
  assert.match(securityCenter, /<input type="hidden" name="captchaToken"/)
})

test("tokens are single-use and the forms wait for one", () => {
  assert.match(authForm, /captcha\.current\?\.reset\(\)/)
  assert.match(forgot, /captcha\.current\?\.reset\(\)/)
  assert.match(authForm, /disabled=\{loading \|\| !captchaToken\}/)
  assert.match(forgot, /disabled=\{sending \|\| !captchaToken\}/)
})

test("Turnstile loads from Cloudflare only and never needs the secret", () => {
  assert.match(turnstile, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/)
  assert.doesNotMatch(turnstile, /process\.env\.[A-Z_]*SECRET/, "The browser component must never read a secret")
  assert.match(turnstile, /action: "turnstile-spin-v1"/)
})

test("password reset doesn't reveal whether an email has an account", () => {
  assert.doesNotMatch(forgot, /setMessage\(error\?\.message/)
})
