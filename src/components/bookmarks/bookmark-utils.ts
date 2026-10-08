export function bookmarkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Saved link"
  }
}

export function bookmarkFavicon(url: string) {
  try {
    return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(new URL(url).hostname) + "&sz=32"
  } catch {
    return null
  }
}

/** Same look as `.issue-menu button`, for links inside the ⋮ menu. */
export const menuLinkClass = "flex w-full items-center gap-[0.55rem] rounded-[0.45rem] px-[0.6rem] py-2 text-left text-[0.85rem] hover:bg-[var(--surface-muted)]"

export const bookmarkCollections = ["General", "Reading", "Tools", "Reference"]
