import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"

if (process.env.RUN_SUPABASE_INTEGRATION !== "true") {
  console.log("Supabase integration check skipped; set RUN_SUPABASE_INTEGRATION=true to run it.")
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
assert.ok(url && key, "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required")

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
for (const table of ["workspace_settings", "notification_preferences", "workspace_google_drive_connections"]) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true })
  assert.equal(error, null, `${table}: ${error?.message ?? "unknown error"}`)
}
console.log("Supabase integration schema check passed")
