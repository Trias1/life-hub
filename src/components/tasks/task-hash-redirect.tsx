"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** Old search results linked to /tasks#task-<id>; the hash never reaches the server, so redirect here. */
export function TaskHashRedirect() {
  const router = useRouter()
  useEffect(() => {
    const match = window.location.hash.match(/^#task-([0-9a-f-]{36})$/i)
    if (match) router.replace("/tasks/" + match[1])
  }, [router])
  return null
}
