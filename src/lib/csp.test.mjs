import assert from "node:assert/strict"
import test from "node:test"
import { newNonce, pageCsp } from "./csp.mjs"

test("each request gets a different, unguessable nonce", () => {
  const nonces = new Set(Array.from({ length: 100 }, newNonce))
  assert.equal(nonces.size, 100)
  for (const nonce of nonces) assert.match(nonce, /^[A-Za-z0-9+/]{24}$/)
})

test("production pages only run our own nonce'd scripts", () => {
  const csp = pageCsp({ nonce: "abc", supabaseUrl: "https://example.supabase.co" })
  assert.match(csp, /script-src 'self' 'nonce-abc' 'strict-dynamic'(;|$)/)
  assert.doesNotMatch(csp, /unsafe-eval/)
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /base-uri 'self'/)
  assert.match(csp, /connect-src 'self' https:\/\/example\.supabase\.co wss:\/\/example\.supabase\.co https:\/\/challenges\.cloudflare\.com/)
  assert.match(csp, /frame-src 'self' https:\/\/challenges\.cloudflare\.com/)
  assert.match(csp, /upgrade-insecure-requests/)
})

test("development adds only what the dev server needs", () => {
  const csp = pageCsp({ nonce: "abc", dev: true })
  assert.match(csp, /'unsafe-eval'/)
  assert.doesNotMatch(csp, /upgrade-insecure-requests/)
})
