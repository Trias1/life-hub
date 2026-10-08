import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  // Only production is indexable; the demo shares prod's database and should stay out of search results.
  if (process.env.VERCEL_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } }
  return { rules: { userAgent: "*", allow: ["/$", "/login", "/register"], disallow: "/" } }
}
