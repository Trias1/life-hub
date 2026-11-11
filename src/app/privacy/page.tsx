import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = { title: "Privacy policy · LifeHub", description: "What LifeHub stores, how it uses Google data, and how to remove it." }

const contact = "triaszaen4@gmail.com"

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="11 November 2026">
      <p>LifeHub is a personal workspace for notes, tasks, a calendar, files and bookmarks, built and run by Trias. This page explains what it stores and why. It has no ads, sells no data and uses no third-party analytics.</p>

      <h2>What LifeHub stores</h2>
      <ul>
        <li><strong>Your account:</strong> email address and sign-in details, handled by Supabase Auth. Passwords are stored only as hashes by Supabase.</li>
        <li><strong>Your profile:</strong> display name, bio and profile photo, if you add them.</li>
        <li><strong>Workspace content:</strong> notes, tasks, comments, checklists, calendar events, bookmarks, team members and invitations, stored in a Supabase Postgres database in Tokyo. Free text such as note bodies, task descriptions, comments, event descriptions and bookmark links is encrypted before it is stored.</li>
        <li><strong>Files:</strong> uploaded files are stored in the Google Drive of the workspace owner who connected it, not on LifeHub&apos;s servers. LifeHub keeps only each file&apos;s name, type, size and Drive file id.</li>
        <li><strong>Activity:</strong> a log of actions in a workspace (for example &quot;created a note&quot;) and notifications for its members.</li>
      </ul>

      <h2>How LifeHub uses Google data</h2>
      <ul>
        <li><strong>Google Drive:</strong> when a workspace owner connects Google Drive, LifeHub creates a LifeHub folder there and uses access only to upload, read, version, share and delete that workspace&apos;s files and profile photos, at your request.</li>
        <li><strong>Google Calendar (read-only):</strong> when you connect your Google account, LifeHub reads your upcoming events to show them next to your LifeHub events. These events are not stored.</li>
        <li><strong>Google sign-in details:</strong> your Google email is used to identify the connected account. Google refresh tokens are encrypted before they are stored and are deleted when you disconnect.</li>
      </ul>
      <p>LifeHub&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. Google data is used only to provide the features above. It is not sold, not used for advertising, not used to train AI or machine-learning models, and not read by people except when you ask for help, for security, or when the law requires it.</p>

      <h2>Who can see your data</h2>
      <p>Members of a workspace can see that workspace&apos;s content and each other&apos;s name, email and profile photo. Share links you create let anyone with the link view that one file until the link expires or the file is moved to the trash. Data is processed by the services LifeHub runs on: Supabase (database and sign-in), Vercel (hosting), Google (Drive, Calendar) and Gmail (invitation emails).</p>

      <h2>Cookies</h2>
      <p>LifeHub uses only the cookies needed to keep you signed in and to protect sign-in with Google. There are no tracking cookies.</p>

      <h2>Keeping and deleting data</h2>
      <ul>
        <li>Disconnect Google Drive in Settings or your Google account in Profile at any time. You can also remove access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</li>
        <li>Deleting a workspace in Settings removes its content from LifeHub. Files already in Google Drive stay in your Drive until you delete them there.</li>
        <li>To delete your account and all of its data, email <a href={"mailto:" + contact}>{contact}</a>.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions about this policy or your data: <a href={"mailto:" + contact}>{contact}</a>. If this policy changes, the date at the top changes with it.</p>
    </LegalPage>
  )
}
