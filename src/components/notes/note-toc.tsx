"use client"

import { type RefObject, useEffect, useState } from "react"
import { headingLabel } from "@/lib/note-tree.mjs"

export type Heading = { element: HTMLElement; label: string; level: number }

/**
 * Reads the headings the note viewer rendered, without changing its DOM (the viewer is a
 * read-only TipTap editor that owns those nodes), and tracks which one is being read.
 */
export function useNoteHeadings(containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const root = containerRef.current
    if (!enabled || !root) {
      setHeadings([])
      return
    }
    const collect = () => {
      const next = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3"))
        .map((element) => ({ element, label: headingLabel(element.textContent), level: Number(element.tagName[1]) }))
        .filter((heading) => heading.label)
      setHeadings((current) => current.length === next.length && current.every((heading, index) => heading.element === next[index].element && heading.label === next[index].label) ? current : next)
    }
    collect()
    const observer = new MutationObserver(collect)
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [containerRef, enabled])

  useEffect(() => {
    if (!headings.length) return
    setActiveIndex(0)
    const observer = new IntersectionObserver((entries) => {
      const top = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActiveIndex(headings.findIndex((heading) => heading.element === top.target))
    }, { rootMargin: "0px 0px -70% 0px" })
    headings.forEach((heading) => observer.observe(heading.element))
    return () => observer.disconnect()
  }, [headings])

  return { headings, activeIndex }
}

export function NoteToc({ headings, activeIndex, onSelect }: { headings: Heading[]; activeIndex: number; onSelect?: () => void }) {
  const go = (heading: Heading) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    heading.element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    onSelect?.()
  }
  const minLevel = Math.min(...headings.map((heading) => heading.level))
  return (
    <ul className="note-toc">
      {headings.map((heading, index) => (
        <li key={index}>
          <button type="button" onClick={() => go(heading)} data-depth={heading.level - minLevel} aria-current={index === activeIndex ? "location" : undefined} className={index === activeIndex ? "is-active" : undefined}>{heading.label}</button>
        </li>
      ))}
    </ul>
  )
}
