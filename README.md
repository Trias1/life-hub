# Sanctum Cove

A self-hosted workspace for notes, tasks, a calendar, files and bookmarks. It runs on your own Supabase project, and files are stored in your own Google Drive.

Live instance: https://lifehub.west-solutions.web.id

Built by Trias. Released under the [MIT License](LICENSE).

## What's inside

| Module | What it does |
|---|---|
| Notes | Rich text with images, folders, tags and pins. Every edit keeps a version you can restore. |
| Tasks | A list and a board, with labels, due dates, checklists, comments and file attachments. |
| Calendar | Agenda, month, week and day views, repeating events and reminders, with your Google Calendar shown alongside. Times are entered and shown in Asia/Jakarta time. |
| Files | Kept in a folder in your own Google Drive, with versions and share links that expire. |
| Bookmarks | Titles are filled in from the page. Group them into collections and import or export CSV. |
| Team | Separate workspaces with member, admin and owner roles. People accept or decline invitations by email. |

Stack: Next.js 16 (App Router, server actions), Supabase (Postgres, Auth, row-level security), Google Drive API, Tailwind CSS.

## Host it yourself

You need Node.js 20 or newer, a [Supabase](https://supabase.com) project and a [Google Cloud](https://console.cloud.google.com) project.

1. Clone the repository and install dependencies.

   ```bash
   git clone https://github.com/Trias1/life-hub
   cd life-hub
   npm install
   ```

2. Copy the example environment file and fill it in (see [Environment variables](#environment-variables)).

   ```bash
   cp .env.example .env.local
   ```

3. Apply the database migrations in `supabase/migrations/` with the [Supabase CLI](https://supabase.com/docs/guides/cli), or paste them in order into the SQL editor.

   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

4. In Google Cloud, create an OAuth client (type "Web application"), enable the Google Drive API and the Google Calendar API, and add these redirect URIs for every domain you serve the app from:

   ```text
   http://localhost:3000/api/auth/google/callback
   http://localhost:3000/api/auth/google/account/callback
   ```

5. In Supabase, under Authentication → URL Configuration, set the Site URL to your domain and add it to the redirect URLs.

6. Start the app.

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and create an account. As the workspace owner, connect Google Drive from Settings → Integrations. To see your Google Calendar next to your events, connect your Google account from Profile.

### Deploying

Any Node.js host that runs Next.js works. On Vercel, add the same environment variables to the project. `vercel.json` schedules the daily calendar reminder job and pins functions to the `hnd1` region; change the region to the one closest to your Supabase project.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable (anon) key. |
| `SUPABASE_SECRET_KEY` | yes | Supabase secret key. Server only. |
| `SUPABASE_JWKS_URL` | yes | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | OAuth client used to connect Google Drive and Google Calendar. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | yes | Random secret that encrypts stored Google refresh tokens. Set it before anyone connects Google: tokens saved under a different key can't be read, so changing it later means reconnecting Google Drive and Google accounts. |
| `DATA_ENCRYPTION_KEY` | recommended | 32 random bytes, base64. Encrypts free text at rest (see below). Keep a backup: values encrypted with a lost key cannot be recovered. |
| `DATA_ENCRYPTION_WRITE` | recommended | Set to exactly `on` to encrypt new writes. Reads always decrypt. |
| `NEXT_PUBLIC_APP_URL` | yes in production | Public URL, used in invitation links. |
| `CRON_SECRET` | for reminders | Shared secret for `/api/calendar/reminders`. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | optional | Send invitation emails through Gmail SMTP. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | optional | Send invitation emails through Resend instead. |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | optional | Service account fallback for storage outside a connected workspace Drive. |

Generate the random keys with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Never prefix a secret with `NEXT_PUBLIC_`, and never commit `.env.local`.

## Security

- Postgres row-level security checks every read and write, not only the app code.
- Free text such as note bodies, task descriptions, comments, checklist items and bookmark URLs is encrypted with AES-256-GCM before it is stored, when `DATA_ENCRYPTION_KEY` and `DATA_ENCRYPTION_WRITE=on` are set. Titles stay readable so search and sorting keep working.
- Search, uploads, exports, sign-in related endpoints and password changes are rate limited, and the limits fail closed if the limiter can't answer. Mutating API requests must come from the same origin.
- File downloads are checked against the active workspace. Share links are hashed, can expire, and stop working once the file is moved to the trash.
- Only the workspace owner can connect or disconnect Google Drive. Invitations are capped per person per day, and a pending invitation can't be sent twice.
- Changing the password signs out every other session, and Security → Active sessions can sign out all other devices at any time.
- Bookmark link previews only fetch public addresses on the default ports, and CSV exports neutralise spreadsheet formulas.
- Responses carry a baseline Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, and cross-origin opener/resource policies.
- Sessions use Supabase SSR cookies; nothing sensitive is kept in `localStorage`.

Found a vulnerability? Please open a private security advisory on GitHub instead of a public issue.

## Development

```bash
npm run dev          # start the dev server
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run self-check   # static safety checks
node --test "src/**/*.test.mjs" "scripts/*.test.mjs"   # unit and source tests
npm run build        # production build
```

Design notes and implementation plans live in `docs/superpowers/`.

## Contributing

Issues and pull requests are welcome. Keep changes focused, run the checks above before opening a pull request, and add a migration file in `supabase/migrations/` for any database change instead of editing an existing one.

## License

[MIT](LICENSE) © 2026 Trias Zaen Mutaqin
