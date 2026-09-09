import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) return response

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
  const { data } = await supabase.auth.getClaims()
  const protectedPaths = ["/dashboard", "/activity", "/bookmarks", "/calendar", "/customize", "/files", "/notes", "/notifications", "/profile", "/security", "/settings", "/tasks", "/team", "/onboarding"]
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/"))
  if (isProtectedPath && !data) return NextResponse.redirect(new URL("/login", request.url))
  return response
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)"] }
