import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" description="Start a private workspace for your notes, tasks and plans." footer={<>Already have an account? <Link href="/login">Sign in</Link></>}>
      <AuthForm mode="register" />
    </AuthShell>
  )
}
