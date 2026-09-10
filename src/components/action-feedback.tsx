"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function ActionFeedback() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const success = searchParams.get("success")

  useEffect(() => {
    const message = error ?? success
    if (!message) return
    if (error) toast.error(message)
    else toast.success(message)
    const next = new URLSearchParams(searchParams.toString())
    next.delete("error")
    next.delete("success")
    const query = next.toString()
    router.replace(query ? pathname + "?" + query : pathname, { scroll: false })
  }, [error, pathname, router, searchParams, success])

  return null
}
