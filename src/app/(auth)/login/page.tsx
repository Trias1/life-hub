import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams
  return (
    <AuthShell title="Sign in" description="Welcome back. Pick up where you left off." error={error} success={success} footer={<>New to Sanctum Cove? <Link href="/register">Create an account</Link></>}>
      <AuthForm mode="login" />
    </AuthShell>
  )
}
