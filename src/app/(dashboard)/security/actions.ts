"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const schema = z.object({ currentPassword: z.string().min(8), newPassword: z.string().min(8).max(128), confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"] })

function fail(message: string): never { redirect("/security?error=" + encodeURIComponent(message)) }

export async function updatePassword(formData: FormData): Promise<void> {
  const input = schema.safeParse({ currentPassword: formData.get("currentPassword"), newPassword: formData.get("newPassword"), confirmPassword: formData.get("confirmPassword") })
  if (!input.success) fail("Use a valid current password and matching new password of at least 8 characters.")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) fail("Your session expired. Sign in again before changing your password.")
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: input.data.currentPassword })
  if (verifyError) fail("Your current password is incorrect.")
  const { error } = await supabase.auth.updateUser({ password: input.data.newPassword })
  if (error) fail("Could not update your password. Please try again.")
  revalidatePath("/security")
  redirect("/security?success=Password%20updated")
}
