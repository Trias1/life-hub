// Content Security Policy for HTML pages, built per request with a fresh nonce (see src/proxy.ts).
// Scripts run only from our own bundles that carry the nonce; anything they load (Turnstile) is
// trusted through 'strict-dynamic'. Injected <script> tags or inline handlers never run.

/** @returns {string} */
export function newNonce() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64")
}

/**
 * @param {{ nonce: string, supabaseUrl?: string, dev?: boolean }} input
 * @returns {string}
 */
export function pageCsp({ nonce, supabaseUrl, dev = false }) {
  let supabase = ""
  try {
    if (supabaseUrl) supabase = new URL(supabaseUrl).host
  } catch {}
  const directives = [
    "default-src 'self'",
    // React needs eval only in development for its debugging stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (React style={...}, Radix, TipTap) need this; it can't run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` https://${supabase} wss://${supabase}` : ""} https://challenges.cloudflare.com${dev ? " ws:" : ""}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ]
  return directives.join("; ")
}
