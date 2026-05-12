# Personal To-Do & Productivity Dashboard

A private workspace at `/me`, auto-active for every logged-in user. v1 covers MVP + productivity tools (Pomodoro, Habits, Streaks, Goals, Badges). AI features deferred to v2.

## Scope (v1)

**In:** Tasks CRUD, priorities, due date/time, statuses, recurring (daily/weekly/monthly/custom), List/Kanban/Calendar views, dashboard widgets, in-app bell + toast notifications, real-time sync, analytics, Pomodoro, Focus mode, Habit tracker, Daily goals, Streaks, Badges, dark/light mode, drag-and-drop, search/filter/sort.

**Deferred to v2:** Timeline view, file attachments, browser push, email, AI prioritization, voice-to-task, team sharing.

## Routes (under new `/me` sidebar group "My Workspace")

```
/me                  Today dashboard (widgets + Quick Add)
/me/tasks            All tasks (List / Kanban toggle, search/filter/sort)
/me/calendar         Month calendar view (drag-and-drop scheduling)
/me/focus            Pomodoro timer + Focus mode
/me/habits           Habit tracker + Daily goals + Streaks + Badges
/me/analytics        Productivity score, completion graphs, heatmap, insights
```

Each route is private (RequireAuth). Data is filtered by `auth.uid()` via RLS — no admin sees others' data.

## Database (new tables, RLS = owner-only)

- **`me_tasks`** — title, description, status (`pending|in_progress|completed|delayed|overdue`), priority (`low|medium|high|urgent`), due_date, due_time, reminder_at, category, tags[], estimated_minutes, completed_at, recurrence_rule (jsonb: freq + interval + byDay), recurrence_parent_id, position (for kanban order), user_id
- **`me_subtasks`** — task_id, title, done, position
- **`me_task_notes`** — task_id, body
- **`me_habits`** — title, color, target_per_week, active, user_id
- **`me_habit_logs`** — habit_id, log_date, done — unique(habit_id,log_date)
- **`me_goals`** — title, target_date, progress, status, user_id
- **`me_focus_sessions`** — task_id (nullable), started_at, ended_at, duration_minutes, type (`pomodoro|short_break|long_break|focus`), completed
- **`me_badges`** — code, earned_at — unique(user_id,code)
- **`me_notifications`** — type, title, body, task_id, read_at, scheduled_for, user_id

All tables: `user_id uuid not null` + RLS policy `user_id = auth.uid()` for select/insert/update/delete. Realtime enabled on `me_tasks` and `me_notifications`.

**Auto-activation for new users:** No seeding needed — the dashboard renders empty-state cards with onboarding tips. RLS means a brand-new user's first visit naturally returns zero rows.

**Recurring regeneration:** Server function `completeTask` — when a task with `recurrence_rule` is marked complete, it inserts the next occurrence (next due_date computed from rule) carrying the same template fields and `recurrence_parent_id`.

**Status auto-roll:** Lightweight client-side derivation on read — if `due_date < today` and status is `pending|in_progress`, present as `overdue`. A nightly pg_cron also flips persisted status to `delayed`/`overdue` and writes a notification row.

## UI architecture

- **Design language:** Premium minimal — soft glass cards, generous spacing, OKLCH tokens already in `src/styles.css`. Add `--me-accent`, `--gradient-me`, `--shadow-glass` tokens. Distinct from existing CRM look so the personal space feels its own product.
- **Animations:** `framer-motion` (already used) for card mount, status transitions, kanban drag, badge unlock, streak pulse.
- **Drag-and-drop:** `@dnd-kit/core` + `@dnd-kit/sortable` for kanban columns and calendar day cells.
- **Calendar:** custom grid built on `date-fns` (already a dep) — no heavy calendar library.
- **Charts:** `recharts` (already in shadcn `chart.tsx`) for completion graphs + weekly bars; custom CSS heatmap for daily activity.

### Reusable components (`src/components/me/`)
`MeShell.tsx` (header w/ bell + quick-add), `TaskCard`, `TaskRow`, `TaskDialog` (create/edit), `QuickAddPopover`, `KanbanBoard`, `CalendarMonth`, `BellPopover` (unread + mark all read), `PomodoroTimer`, `HabitGrid`, `StreakBadge`, `ProductivityScoreCard`, `WidgetGrid`.

### Today dashboard widgets
Today's Tasks · Upcoming Deadlines (next 7 days) · Pending Work · Completed Today · Productivity Score (% of due-today done) · Current Streak · Quick Add.

## Notifications (in-app)

- Bell icon in `MeShell` header → popover lists unread `me_notifications`, red badge count.
- Realtime subscription on `me_notifications` triggers a `sonner` toast for new rows.
- Reminder generator (pg_cron, every 5 min): inserts notification rows for tasks with `reminder_at` between now and now+5min, and for newly overdue items.
- Browser tab title updates with unread count.

## Productivity tools

- **Pomodoro:** 25/5/15 default, configurable, ties session to optional task, logs to `me_focus_sessions`. Persists across route changes via Zustand store.
- **Focus mode:** full-screen overlay hiding sidebar, timer + current task only, ESC to exit.
- **Habit tracker:** weekly grid (7 days × habits), tap to toggle, computes streak.
- **Daily goals:** small list pinned to Today.
- **Badges:** rules engine on the client (`first_task`, `7_day_streak`, `100_completed`, `pomodoro_pro_10`, `early_bird`) → inserts row into `me_badges` once and shows celebration toast.

## Sidebar integration

Add a new collapsible group "My Workspace" in `AppSidebar.tsx` (above HR), visible to every authenticated user. Items: Today, Tasks, Calendar, Focus, Habits, Analytics. Bell badge shown next to "Today".

## Files to create

```
src/routes/me.tsx                 (layout with <Outlet/>)
src/routes/me.index.tsx           (Today dashboard)
src/routes/me.tasks.tsx
src/routes/me.calendar.tsx
src/routes/me.focus.tsx
src/routes/me.habits.tsx
src/routes/me.analytics.tsx
src/lib/me.ts                     (hooks: useMyTasks, useTodayTasks, useHabits, etc.)
src/lib/me-recurrence.ts          (next-occurrence calculator)
src/lib/me-badges.ts              (rules engine)
src/components/me/*                (components listed above)
src/stores/pomodoro.ts            (Zustand)
supabase/migrations/<ts>_me_workspace.sql
```

## Files to edit

- `src/components/AppSidebar.tsx` — add "My Workspace" group + bell badge.
- `src/styles.css` — add `--me-*` tokens.
- `src/router.tsx` — no manual edits (file-based routing handles it).

## Dependencies to add

`@dnd-kit/core`, `@dnd-kit/sortable`, `zustand`, `rrule` (recurrence rule parser).

## Out of scope reminders

I'll add visible "Coming soon" stubs for AI helpers, attachments, voice-to-task, browser push, and team sharing so the v2 path is obvious without shipping half-built features.

After approval I'll ship the migration first, then build screens top-down (Today → Tasks → Kanban/Calendar → Focus/Habits → Analytics).
