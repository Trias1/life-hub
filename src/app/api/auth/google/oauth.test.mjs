import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n")
const flow = read("../../../../lib/google-oauth-flow.ts")
const auth = read("../../../../lib/google-drive-auth.ts")
const routes = {
  driveLogin: read("./login/route.ts"),
  driveCallback: read("./callback/route.ts"),
  accountLogin: read("./account/login/route.ts"),
  accountCallback: read("./account/callback/route.ts"),
}

test("both Google sign-ins use PKCE with S256 and a random state", () => {
  assert.match(flow, /generateCodeVerifierAsync\(\)/)
  assert.match(flow, /code_challenge_method: Auth\.CodeChallengeMethod\.S256/)
  assert.match(flow, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/)
  assert.match(routes.driveLogin, /startGoogleOAuth\(request, \{ flow: "drive"/)
  assert.match(routes.accountLogin, /startGoogleOAuth\(request, \{ flow: "account"/)
})

test("callbacks need the verifier and a state bound to the same user (and workspace)", () => {
  assert.match(flow, /timingSafeEqual\(expected, given\)/)
  assert.match(flow, /pending\.userId !== input\.userId/)
  assert.match(flow, /pending\.workspaceId !== input\.workspaceId/)
  assert.match(flow, /"__Host-"/)
  assert.match(routes.driveCallback, /finishGoogleOAuth\(request, \{ flow: "drive", userId: context\.user\.id, workspaceId: context\.workspaceId \}\)/)
  assert.match(routes.driveCallback, /context\.role !== "super_admin"/)
  assert.match(routes.accountCallback, /finishGoogleOAuth\(request, \{ flow: "account", userId: context\.user\.id \}\)/)
  for (const callback of [routes.driveCallback, routes.accountCallback]) assert.match(callback, /getToken\(\{ code, codeVerifier \}\)/)
})

test("workspace Drive connections ask only for drive.file", () => {
  assert.match(auth, /GOOGLE_DRIVE_OAUTH_SCOPES = \["https:\/\/www\.googleapis\.com\/auth\/drive\.file"\]/)
  assert.match(routes.driveLogin, /scopes: GOOGLE_DRIVE_OAUTH_SCOPES/)
  assert.doesNotMatch(routes.driveLogin + routes.accountLogin, /GOOGLE_DRIVE_SCOPE\b/)
})
