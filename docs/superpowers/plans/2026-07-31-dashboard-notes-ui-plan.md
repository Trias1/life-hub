# Dashboard Modules UI Implementation Plan

> Execute inline in this session. Do not commit changes or apply Supabase migrations remotely.

**Goal:** Implement the documented UI improvements for Dashboard, Notes, Activity, Bookmarks, Calendar, Files, Tasks, Team, and Profile in sequence.

**Architecture:** Keep the current Next.js App Router and server-action structure. Prefer page-level composition and existing components over new abstractions; use URL search params for server-rendered filters and existing client components only where interaction already requires client state.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, existing Supabase SSR helpers, existing server actions, and installed Lucide icons.

---

## Task 1: Dashboard

Files: src/app/(dashboard)/dashboard/page.tsx; src/app/globals.css only if an existing dashboard utility is missing.

- [ ] Query latest workspace notes, files, and upcoming events alongside existing counts.
- [ ] Render a personalized greeting from the authenticated user/profile display name.
- [ ] Add Continue Working, Recent Notes, Recent Files, Upcoming Events, and Workspace Health sections using existing surface/grid classes.
- [ ] Keep Activity Feed on the right at desktop widths and collapse to one column on smaller screens.
- [ ] Verify empty states remain useful when each query returns no rows.

## Task 2: Notes

Files: src/app/(dashboard)/notes/page.tsx; src/components/notes-workspace.tsx; src/components/note-composer.tsx if needed; src/app/(dashboard)/notes/actions.ts only for existing supported metadata.

- [ ] Keep Active, Archived, and Trash in query-driven tabs without remounting the sidebar.
- [ ] Add compact quick capture above the notes workspace.
- [ ] Split notes into pinned/recent presentation while keeping the selected-note editor.
- [ ] Show folder and tag chips from existing columns; do not add a markdown dependency.
- [ ] Keep autosave status and version restore visible.

## Task 3: Activity

Files: src/app/(dashboard)/activity/page.tsx and src/app/globals.css only for missing timeline utilities.

- [ ] Parse filter, search, and grouping parameters from searchParams.
- [ ] Filter activity rows by entity type and text before rendering.
- [ ] Group rows into Today, Yesterday, Last 7 Days, and Older using standard date comparisons.
- [ ] Keep existing workspace scope and empty state.

## Task 4: Bookmarks

Files: src/app/(dashboard)/bookmarks/page.tsx and actions.ts only where current fields support it.

- [ ] Add quick add, search, collection/status/tag controls, and grid/list state through query parameters.
- [ ] Keep cards compact with favicon/title/url/description metadata already available.
- [ ] Keep export and existing archive/favorite actions intact.

## Task 5: Calendar

Files: src/app/(dashboard)/calendar/page.tsx and actions.ts only for existing edit/delete support.

- [ ] Add header, primary create action, view controls, and upcoming/agenda content.
- [ ] Preserve existing event creation and workspace scoping.
- [ ] Surface empty/loading states without adding a calendar package.

## Task 6: Files

Files: src/app/(dashboard)/files/page.tsx and actions.ts only for supported metadata behavior.

- [ ] Keep private upload and rollback behavior.
- [ ] Improve upload/filter/favorite/storage hierarchy and folder-aware empty state.
- [ ] Keep signed downloads and existing trash behavior.

## Task 7: Tasks

Files: src/app/(dashboard)/tasks/page.tsx; src/components/task-board.tsx; actions.ts only for existing fields.

- [ ] Add quick-create area and board/list presentation controls.
- [ ] Surface priority, status, assignee, and due-date metadata already available.
- [ ] Keep task mutations server-side and preserve workspace filtering.

## Task 8: Team

Files: src/app/(dashboard)/team/page.tsx and actions.ts only for currently supported invite/member mutations.

- [ ] Add search, role/status filters, member cards/table, and invitation state presentation.
- [ ] Keep destructive actions behind existing authorization checks.
- [ ] Avoid controls for unsupported remove/role-change operations.

## Task 9: Profile

Files: src/app/(dashboard)/profile/page.tsx; src/components/profile-studio.tsx; src/app/globals.css only for profile consistency.

- [ ] Preserve working Full name/Username save and private avatar upload.
- [ ] Align overview, activity, security, sessions, and connected-account tabs with the documented hierarchy.
- [ ] Keep unavailable integrations disabled rather than faking persistence.

## Validation after each batch

- [ ] Run npm run typecheck.
- [ ] Run npm run lint.
- [ ] Run npm run self-check.
- [ ] Run git diff --check from lifehub-app.
- [ ] If a migration is added, leave it in supabase/migrations and report that it needs manual Supabase execution.
