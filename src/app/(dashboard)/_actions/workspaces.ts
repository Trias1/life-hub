"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { setActiveWorkspace } from "@/lib/workspace/server"

export async function selectWorkspace(formData: FormData): Promise<void> {
  const input = z.object({ workspaceId: z.string().uuid() }).safeParse({ workspaceId: formData.get("workspaceId") })
  if (!input.success) actionFailure("/dashboard", "switch workspace")
  const result = await setActiveWorkspace(input.data.workspaceId)
  if (result.error) actionFailure("/dashboard", "switch workspace")
  revalidatePath("/dashboard")
  revalidatePath("/notes")
  revalidatePath("/tasks")
  revalidatePath("/calendar")
  revalidatePath("/files")
  revalidatePath("/bookmarks")
  revalidatePath("/team")
  revalidatePath("/", "layout")
  redirect("/dashboard?workspace=" + input.data.workspaceId)
}
