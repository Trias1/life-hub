import { apiBucket, checkRequestLimit, isCrossOriginApiMutation } from "@/lib/request-rate-limit.mjs"
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const bucket = apiBucket(request.nextUrl.pathname)
  const reject = (status: number, error: string, retryAfter?: number) => {
    const denied = NextResponse.json({ error }, { status })
    denied.headers.set("Cache-Control", "no-store")
    if (retryAfter) denied.headers.set("Retry-After", String(retryAfter))
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie))
    return denied
  }
  if (isCrossOriginApiMutation(request)) return reject(403, "Same-origin request required")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) return bucket ? reject(503, "Authentication temporarily unavailable", 60) : response

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  let userId: string | undefined
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (!error && typeof data?.claims?.sub === "string" && data.claims.sub) userId = data.claims.sub
  } catch {
    if (bucket) return reject(503, "Authentication temporarily unavailable", 60)
  }
  const path = request.nextUrl.pathname
  // 2FA: an account with a verified authenticator must finish the code step (aal2) before using the app.
  // The factor list comes from the session cookie, so this is the UX gate; the database enforces aal2 (0034).
  let needsMfa = false
  if (userId) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    needsMfa = assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2"
  }
  // Public share links stay public; everything else under /api waits for the code.
  if (needsMfa && path.startsWith("/api/") && !path.startsWith("/api/shared/")) return reject(401, "Two-factor verification required")
  if (bucket) {
    if (!userId) return reject(401, "Authentication required")
    const denied = await checkRequestLimit(supabase, bucket)
    if (denied) return reject(denied.status, denied.error, denied.retryAfter)
    response.headers.set("Cache-Control", "no-store")
  }
  const redirectTo = (target: string) => {
    const redirect = NextResponse.redirect(new URL(target, request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }
  const protectedPaths = ["/dashboard", "/activity", "/bookmarks", "/calendar", "/customize", "/files", "/invites", "/notes", "/notifications", "/profile", "/security", "/settings", "/tasks", "/team", "/onboarding"]
  const isProtectedPath = protectedPaths.some((protectedPath) => path === protectedPath || path.startsWith(protectedPath + "/"))
  if ((isProtectedPath || path === "/mfa") && !userId) return NextResponse.redirect(new URL("/login", request.url))
  if (needsMfa && (isProtectedPath || path === "/login" || path === "/register" || path === "/")) return redirectTo("/mfa")
  if (userId && !needsMfa && path === "/mfa") return redirectTo("/dashboard")
  // Already signed in: skip the auth forms and go straight to the workspace.
  if (userId && (path === "/login" || path === "/register" || path === "/")) return redirectTo("/dashboard")
  return response
}

export const config = { matcher: ["/api/:path*", "/((?!_next/static|_next/image|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)"] }
