export function apiBucket(pathname) {
  const path = pathname.replace(/\/+$/, "")
  // Profile photos are read-only GETs, several per page (sidebar, Team list): give them the 60/min read budget.
  if (path === "/api/search" || path === "/api/profile/avatar") return "search"
  if (path === "/api/notes/upload-image") return "upload"
  if (["/api/workspace/export", "/api/bookmarks/export"].includes(path)) return "export"
  // Backup downloads (owner only), but not the hourly job, which has no user session.
  if (path.startsWith("/api/backup/") && path !== "/api/backup/cron") return "export"
  if (path === "/api/bookmarks/fetch-meta") return "fetch-meta"
  if (path === "/api/auth/google/login" || path === "/api/auth/google/callback" || path === "/api/auth/google/account/login" || path === "/api/auth/google/account/callback") return "oauth"
  return null
}

export function isCrossOriginApiMutation(request) {
  const url = new URL(request.url)
  return url.pathname.startsWith("/api/")
    && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
    && request.headers.get("origin") !== url.origin
}

export async function checkRequestLimit(supabase, bucket) {
  const unavailable = { status: 503, error: "Request limit temporarily unavailable", retryAfter: 60 }
  try {
    const { data, error } = await supabase.rpc("consume_request_rate_limit", { p_bucket: bucket })
    // Fail closed on every error, including a missing function (migration 0028 is required).
    if (error || !data || typeof data.allowed !== "boolean"
      || !Number.isInteger(data.retry_after) || data.retry_after < 0 || data.retry_after > 60) return unavailable
    return data.allowed ? null : { status: 429, error: "Too many requests", retryAfter: Math.max(1, data.retry_after) }
  } catch {
    return unavailable
  }
}
