# LifeHub Dashboard Modules UI Design

**Goal:** Bring the nine modules in LifeHub_Dashboard_Notes_UI_Spec/docs into one consistent workspace UI without changing the existing application architecture.

**Scope:** Dashboard, Notes, Activity, Bookmarks, Calendar, Files, Tasks, Team, and Profile in that order.

**Design:** Reuse the existing App Router pages, server actions, Sidebar, Top Navbar, and Supabase queries. Each module receives the smallest UI change that closes the documented gap; existing working behavior stays intact. New backend fields or policies are collected as migrations only when a documented interaction cannot use the current schema.

**Interaction rules:** Keep one primary action per page, preserve active workspace scoping, use URL search parameters for filter/view state, keep forms accessible, and show existing action errors through the shared feedback component.

**Validation:** Run npm run typecheck, npm run lint, and npm run self-check after each implementation batch and before handoff.

## Module outcomes

1. Dashboard adds personalized greeting, richer metric secondary text, continue-working/recent content, upcoming events, activity, and workspace health.
2. Notes keeps the existing split editor and autosave, while adding compact capture, pinned/recent grouping, visible folder/tag metadata, and the Active/Archived/Trash flow.
3. Activity adds query-driven filter/search/grouping while reusing existing activity rows and activity log data.
4. Bookmarks adds quick add, search/filter controls, and view presentation without replacing existing CRUD actions.
5. Calendar adds documented view/action hierarchy around the existing event data and actions.
6. Files improves upload, folder/filter, favorite, storage, and empty-state hierarchy around the existing private storage flow.
7. Tasks improves board/list hierarchy, quick create, filters, and priority/status presentation around existing task actions.
8. Team improves member/invitation presentation, role/filter controls, and detail affordances without inventing unsupported backend operations.
9. Profile keeps the working save/avatar flow and aligns its content hierarchy with the profile spec.
