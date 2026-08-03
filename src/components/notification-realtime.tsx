"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function NotificationRealtime({ userId }: { userId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel("lifehub-notifications-" + userId).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "recipient_id=eq." + userId }, () => router.refresh()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [router, userId])

  return null
}
