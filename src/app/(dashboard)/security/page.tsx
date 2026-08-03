import { SecurityCenter } from "@/components/security-center"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { signOut } from "../_actions/auth"
import { updatePassword } from "./actions"

export default async function SecurityPage() {
  const context = await getWorkspaceContext()
  if (!context) return null
  return <SecurityCenter email={context.user.email ?? ""} lastSignIn={context.user.last_sign_in_at ?? null} updatePassword={updatePassword} signOut={signOut} />
}
