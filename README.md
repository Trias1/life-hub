# LifeHub App

Next.js 15 + Supabase SSR workspace app.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Isi `.env.local` dengan:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

## Verification

```bash
npm run lint
npm run self-check
npm run build
```

## Supabase migrations

Migration dikumpulkan di `supabase/migrations/` dan belum dijalankan otomatis.
Jalankan setelah project Supabase siap dan credentials sudah dikonfigurasi:

```bash
supabase db push
```

Migration saat ini:

- `0001_workspace.sql`
- `0002_core_modules.sql`
- `0003_calendar_bookmarks.sql`
- `0004_files_notifications_activity.sql`
- `0005_team_invitations.sql`
- `0006_storage_bucket.sql`
- `0007_repair_workspace_membership.sql` through `0013_note_versions.sql`
- `0014_backend_foundations.sql`
- `0015_advanced_module_backend.sql`
- `0016_notification_center.sql`

Jangan menjalankan migration production tanpa review dan backup.
