"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

// Public site key of the "lifehub-auth" Turnstile widget (allowed only on LifeHub's own hostnames).
// Self-hosters set NEXT_PUBLIC_TURNSTILE_SITE_KEY to their own widget. Supabase Auth verifies the token
// server-side with the secret key (Attack Protection → CAPTCHA), so nothing here is trusted on its own.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAF80ysviPbwj_-h9"

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null
function loadTurnstile() {
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export type TurnstileHandle = { reset: () => void }

/**
 * Cloudflare Turnstile, invisible unless Cloudflare wants an interaction. Calls onToken with a fresh
 * token, or null when it expires or fails. Tokens are single-use: call reset() after every attempt.
 */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void }>(function Turnstile({ onToken }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const callback = useRef(onToken)
  const [failed, setFailed] = useState(false)
  useEffect(() => { callback.current = onToken }, [onToken])

  useImperativeHandle(ref, () => ({
    reset() {
      callback.current(null)
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    },
  }), [])

  useEffect(() => {
    let cancelled = false
    loadTurnstile().then((turnstile) => {
      if (cancelled || !container.current) return
      widgetId.current = turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: "turnstile-spin-v1",
        appearance: "interaction-only",
        theme: "auto",
        callback: (token: string) => { setFailed(false); callback.current(token) },
        "expired-callback": () => callback.current(null),
        "error-callback": () => { setFailed(true); callback.current(null) },
      })
    }).catch(() => setFailed(true))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [])

  return (
    <div>
      <div ref={container} />
      {failed && <p role="alert" className="mt-2 text-sm text-danger">The security check couldn&apos;t load. Refresh the page and try again.</p>}
    </div>
  )
})
