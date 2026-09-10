import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")
  if (!rawUrl) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SanctumCove/1.0)" },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return NextResponse.json({ error: "Failed to fetch" }, { status: 422 })
    const html = await response.text()
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      ""
    const description =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      ""
    return NextResponse.json({ title, description })
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 422 })
  }
}
