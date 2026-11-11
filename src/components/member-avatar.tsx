"use client"

import { useState } from "react"

/** A member's photo, falling back to their initial when there's no photo or it fails to load (e.g. its Drive is disconnected). */
export function MemberAvatar({ src, name, className = "" }: { src: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const base = "size-8 shrink-0 rounded-full " + className
  if (!src || failed) return <span aria-hidden className={base + " grid place-items-center bg-[var(--surface-muted)] text-sm font-bold uppercase text-[var(--foreground)]"}>{name.slice(0, 1)}</span>
  // eslint-disable-next-line @next/next/no-img-element -- served by our own authenticated route, not optimisable by next/image
  return <img src={src} alt="" width={32} height={32} loading="lazy" onError={() => setFailed(true)} className={base + " object-cover"} />
}
