import Link from "next/link"

type PaginationProps = {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null
  const prevPage = Math.max(1, page - 1)
  const nextPage = Math.min(totalPages, page + 1)
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3 text-sm">
      <Link
        href={buildHref(prevPage)}
        aria-disabled={page <= 1}
        className={page <= 1 ? "button-quiet pointer-events-none opacity-40" : "button-quiet"}
      >
        Previous
      </Link>
      <span className="text-xs text-[var(--muted)]">
        Page {page} of {totalPages}
      </span>
      <Link
        href={buildHref(nextPage)}
        aria-disabled={page >= totalPages}
        className={page >= totalPages ? "button-quiet pointer-events-none opacity-40" : "button-quiet"}
      >
        Next
      </Link>
    </nav>
  )
}
