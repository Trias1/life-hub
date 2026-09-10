"use server"

import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { redirect } from "next/navigation"

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

function fail(message: string): never { redirect(`/onboarding?error=${encodeURIComponent(message)}`) }

export async function createWorkspace(formData: FormData): Promise<void> {
  const input = schema.safeParse({ name: formData.get("name"), slug: formData.get("slug") })
  if (!input.success) fail("Use a name and a lowercase slug like my-workspace.")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) fail("You must sign in first.")

  const { data: workspaceId, error } = await supabase.rpc("create_workspace", { workspace_name: input.data.name, workspace_slug: input.data.slug })
  if (error || typeof workspaceId !== "string") fail(error?.code === "23505" ? "That workspace slug is already taken." : `Workspace could not be created (${error?.code ?? "unknown"}).`)
  redirect("/dashboard?workspace=" + encodeURIComponent(workspaceId))
}
