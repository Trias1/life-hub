import { bookmarkFavicon, bookmarkHost } from "./bookmark-utils"

/** Site favicon drawn as a background image, with the host's first letter as fallback. */
export function BookmarkFavicon({ url, size = 16, className = "" }: { url: string; size?: number; className?: string }) {
  const favicon = bookmarkFavicon(url)
  const host = bookmarkHost(url)
  return (
    <span
      aria-hidden
      className={"grid shrink-0 place-items-center overflow-hidden rounded bg-[var(--surface-muted)] text-[0.65rem] font-semibold text-[var(--muted)] " + className}
      style={{ width: size, height: size, ...(favicon ? { backgroundImage: "url(" + favicon + ")", backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundSize: "contain" } : {}) }}
    >
      {favicon ? null : host.charAt(0).toUpperCase()}
    </span>
  )
}
