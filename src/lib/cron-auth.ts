import { timingSafeEqual } from "node:crypto"

/** Scheduled jobs send "Authorization: Bearer <CRON_SECRET>" (Vercel Cron and the Supabase pg_cron job). */
export function isCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from("Bearer " + secret)
  const received = Buffer.from(request.headers.get("authorization") ?? "")
  return received.length === expected.length && timingSafeEqual(received, expected)
}
