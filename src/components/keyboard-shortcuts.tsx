"use client"

import { useEffect, useState } from "react"

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === "Escape") return setOpen(false)
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (event.key === "?") setOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return open ? <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/30 p-4" role="presentation" onClick={() => setOpen(false)}><section className="surface w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onClick={(event) => event.stopPropagation()}><div className="toolbar"><h2 id="shortcut-title" className="font-semibold">Keyboard shortcuts</h2><button type="button" onClick={() => setOpen(false)} className="button-quiet min-h-0 px-2 py-1 text-xs">Close</button></div><div className="mt-5 space-y-3 text-sm"><p className="flex items-center justify-between"><span>Open shortcuts</span><kbd className="rounded border bg-zinc-100 px-2 py-1 text-xs">?</kbd></p><p className="flex items-center justify-between"><span>Close dialog</span><kbd className="rounded border bg-zinc-100 px-2 py-1 text-xs">Esc</kbd></p></div></section></div> : null
}
