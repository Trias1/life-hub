import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = { title: "Terms of service · LifeHub", description: "The terms for using LifeHub." }

const contact = "triaszaen4@gmail.com"

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="11 November 2026">
      <p>LifeHub is a personal, open-source workspace run by Trias. By creating an account or using it, you agree to these terms.</p>

      <h2>Using LifeHub</h2>
      <ul>
        <li>Keep your sign-in details to yourself. You are responsible for what happens in your account and the workspaces you own.</li>
        <li>Use LifeHub only for lawful purposes. Don&apos;t upload malware, content you have no right to share, or anything that harms others.</li>
        <li>Don&apos;t try to break, overload or get around the security of the service or other people&apos;s workspaces.</li>
        <li>LifeHub isn&apos;t a password manager. Store passwords and other secrets in a dedicated password manager.</li>
      </ul>

      <h2>Your content</h2>
      <p>You own what you put into LifeHub. You allow LifeHub to store, process and show it only to provide the service to you and the members of your workspaces. How data is handled is described in the <a href="/privacy">privacy policy</a>.</p>

      <h2>Google services</h2>
      <p>Connecting Google Drive or Google Calendar is optional. Files in Google Drive are also subject to Google&apos;s terms, and you can disconnect at any time.</p>

      <h2>Availability</h2>
      <p>LifeHub is provided as is, without warranties, as a personal project. It may change, be interrupted or be shut down. Keep your own copies of anything important; workspace owners can export their data from Settings.</p>

      <h2>Ending access</h2>
      <p>You can stop using LifeHub and ask for your account to be deleted at any time. Accounts that break these terms may be suspended or removed.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, LifeHub and its author are not liable for lost data, lost profits or indirect damages from using or not being able to use the service.</p>

      <h2>Changes and contact</h2>
      <p>If these terms change, the date at the top changes with them. Questions: <a href={"mailto:" + contact}>{contact}</a>.</p>
    </LegalPage>
  )
}
