"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { usePathname, useSearchParams } from "next/navigation"

export function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion()
  const query = searchParams.toString()
  const routeKey = query ? `${pathname}?${query}` : pathname

  return <AnimatePresence initial={false} mode="popLayout"><motion.div key={routeKey} className="relative" initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -2 }} transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}>{children}</motion.div></AnimatePresence>
}
