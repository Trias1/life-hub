"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SignOutAction = () => Promise<void>

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000
const WARNING_TIMEOUT_MS = 55 * 60 * 1000

export function InactivityGuard({ signOut }: { signOut: SignOutAction }) {
  const [warningVisible, setWarningVisible] = useState(false)
  const logoutTimer = useRef<number | null>(null)
  const warningTimer = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (logoutTimer.current !== null) window.clearTimeout(logoutTimer.current)
    if (warningTimer.current !== null) window.clearTimeout(warningTimer.current)
    logoutTimer.current = null
    warningTimer.current = null
  }, [])

  const resetTimer = useCallback(() => {
    clearTimers()
    setWarningVisible(false)
    warningTimer.current = window.setTimeout(() => {
      setWarningVisible(true)
    }, WARNING_TIMEOUT_MS)
    logoutTimer.current = window.setTimeout(() => {
      void signOut()
    }, INACTIVITY_TIMEOUT_MS)
  }, [clearTimers, signOut])

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const
    const handleActivity = () => resetTimer()
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))
    resetTimer()
    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity))
      clearTimers()
    }
  }, [clearTimers, resetTimer])

  if (!warningVisible) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--foreground)] shadow-2xl" role="alertdialog" aria-live="assertive" aria-label="Session inactivity warning">
      <p className="text-sm font-semibold">You&apos;ll be logged out in 5 minutes due to inactivity.</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Stay active to keep your session open.</p>
      <button type="button" onClick={resetTimer} className="button-primary mt-3 min-h-0 px-3 py-2 text-xs">
        Stay logged in
      </button>
    </div>
  )
}
