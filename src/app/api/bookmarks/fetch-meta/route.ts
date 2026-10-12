import { NextRequest, NextResponse } from "next/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { fetchPublicHtml } from "./safe-fetch.mjs"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rawUrl = request.nextUrl.searchParams.get("url")
  if (!rawUrl) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  // Default ports only, so the endpoint can't be used to probe arbitrary services from our servers.
  if (!['http:', 'https:'].includes(url.protocol) || (url.port && !['80', '443'].includes(url.port))) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  try {
    const html = await fetchPublicHtml(url.href)
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      ""
    const description =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      ""
    return NextResponse.json({ title: title.slice(0, 300), description: description.slice(0, 500) })
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 422 })
  }
}
