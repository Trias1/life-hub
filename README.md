# Sanctum Cove App

Next.js 16 + Supabase SSR workspace app with Google Drive-backed file storage.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Isi `.env.local` dengan konfigurasi berikut. Jangan commit file `.env.local` atau secret production:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-server-only-supabase-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_TOKEN_ENCRYPTION_KEY=your-random-encryption-key
```

`SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` are server-only variables. Never prefix them with `NEXT_PUBLIC_`.

## Verification

```bash
npm run lint
npm run typecheck
npm run self-check
npm run build
npm audit
```

The current dependency audit is clean with zero reported vulnerabilities.

## Security notes

- Authentication sessions use Supabase SSR cookies; application tokens are not stored in localStorage.
- Workspace authorization is enforced in server actions, API routes, and Supabase Row Level Security policies.
- File downloads are scoped to the active workspace, and shared links use hashed, expiring tokens.
- Uploads validate file size and MIME type on the server.
- Apply Supabase Auth rate limits/CAPTCHA, email confirmation, password recovery expiry, and production redirect URL allowlists before going live.

## Supabase migrations

Migration dikumpulkan di `supabase/migrations/` dan belum dijalankan otomatis.
Jalankan setelah project Supabase siap dan credentials sudah dikonfigurasi:

```bash
supabase db push
```

Migration terbaru:

- `0001_workspace.sql` through `0013_note_versions.sql`
- `0014_backend_foundations.sql` through `0021_calendar_reminders.sql`
- `0022_protect_workspace_membership.sql`
- `0023_workspace_settings_time_format.sql`
- `0024_note_task_delete_policies.sql`
- `0025_security_hardening.sql`

Jangan menjalankan migration production tanpa review dan backup.

## Production

Production URL: https://life-hub.west-solutions.web.id

Deploy dengan:

```bash
vercel --prod
```

Terakhir diverifikasi pada 9 September 2026.

## License

Released under the [MIT License](LICENSE).
