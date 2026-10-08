"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const responseSchema = z.object({ id: z.string().uuid(), decision: z.enum(["accept", "decline"]), returnTo: z.enum(["/invites", "/dashboard", "/onboarding"]).default("/invites") })

export async function respondToInvitation(formData: FormData): Promise<void> {
  const input = responseSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision"), returnTo: formData.get("returnTo") ?? undefined })
  if (!input.success) redirect("/invites?error=" + encodeURIComponent("That invitation could not be found."))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // The function checks the confirmed email, expiry and state itself, then joins or declines atomically.
  const { error } = await supabase.rpc("respond_to_my_invitation", { invitation_id: input.data.id, accept: input.data.decision === "accept" })
  if (error) {
    const message = error.code === "42501" ? "Confirm your email address before answering invitations." : "This invitation is no longer available."
    redirect(input.data.returnTo + "?error=" + encodeURIComponent(message))
  }

  revalidatePath("/", "layout")
  if (input.data.decision === "accept") redirect("/dashboard?success=" + encodeURIComponent("You joined the workspace"))
  redirect(input.data.returnTo + "?success=" + encodeURIComponent("Invitation declined"))
}
