"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function ActionFeedback() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  if (!error) return null

  function dismiss() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("error")
    const query = next.toString()
    router.replace(query ? pathname + "?" + query : pathname, { scroll: false })
  }

  return <div className="fixed bottom-4 right-4 z-[100] flex max-w-sm items-start gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-800 shadow-xl dark:border-red-900 dark:bg-zinc-950 dark:text-red-200" role="alert"><p className="flex-1">{error}</p><button type="button" onClick={dismiss} className="font-semibold" aria-label="Dismiss error">Close</button></div>
}
