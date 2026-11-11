import { AuthShell } from "@/components/auth/auth-shell"
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form"

export default function MfaPage() {
  return (
    <AuthShell title="Two-factor check" description="Open your authenticator app and enter the 6-digit code for Sanctum Cove.">
      <MfaChallengeForm />
    </AuthShell>
  )
}
