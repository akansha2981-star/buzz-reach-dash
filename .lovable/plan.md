
# Habit Tracker — Plan

Add a full-featured Habit Tracker as a new section directly below "My Workspace" on the workspace page. It integrates with the existing Lovable Cloud backend and does not touch current features.

## 1. Database (new tables, RLS-scoped to `auth.uid()`)

I'll reuse the existing `me_habits` / `me_habit_logs` if suitable, but they lack the fields required here (custom tracking fields, targets, reminders, frequency, per-log values). I'll extend the schema with a compatible migration:

- `me_habits` — add columns: `icon` (emoji), `category`, `start_date`, `reminder_times text[]`, `frequency` (`daily`|`weekly`|`custom`), `custom_days int[]` (0–6), `color`, `archived boolean`.
- `me_habit_fields` — one row per custom tracking field on a habit:
  - `habit_id`, `key`, `label`, `type` (`number`|`decimal`|`time`|`duration`|`distance`|`weight`|`calories`|`water`|`custom`), `unit`, `target_value`, `target_period` (`day`|`week`|`month`), `sort_order`.
- `me_habit_logs` — extend with: `log_date`, `completed boolean`, `values jsonb` (map of field_key → value), `notes`. Unique on `(habit_id, log_date)`.

All tables: `authenticated` GRANTs + `service_role` GRANT, RLS enabled, policies scoped to `auth.uid() = user_id`, `updated_at` trigger.

## 2. Backend access

- Client-side reads/writes via the browser Supabase client (RLS handles auth). No server functions needed — matches how `me_tasks` is used today.

## 3. UI — new section on the workspace page

Placed directly under the existing My Workspace tasks section. Design matches the current polished dark-glass theme (gradient cards, framer-motion, lucide icons, semantic tokens).

Components (`src/components/habits/`):
- `HabitsSection.tsx` — header ("Habit Tracker" + subtitle), "New Habit" button, filter chips (All / Today / Category), grid of `HabitCard`s, and an inline `HabitAnalytics` strip.
- `HabitCard.tsx` — emoji, name, category chip, current streak, today's completion ring, quick "Complete" one-tap button, mini 7-day dots, click → summary page.
- `HabitDialog.tsx` — create/edit habit: name, emoji picker, category (uses `me_categories`), start date, frequency (Daily/Weekly/Custom days with day toggles), reminder times (add multiple), and a **Custom Fields** builder (add field → pick type from the list above → label + unit + optional target + period). Uses framer-motion transitions and chip-style selectors like the task dialog.
- `CheckInDialog.tsx` — opens on "Complete". Shows only that habit's fields with the right input widgets (number/decimal/time picker/duration mm:ss/distance/weight/calories/water/custom-unit). Includes **"Same as yesterday"** button (fetches last log, prefills values, user can edit). Saves to `me_habit_logs` with `completed=true` and `values` jsonb.
- `HabitSummary.tsx` (route `/_authenticated/habits/$habitId`) — dedicated summary page: current streak, longest streak, total completions, target achievement %, avg / best / cumulative per field, historical line/bar charts (recharts), calendar heatmap, milestone badges, and an editable **History** list (tap a past day to edit its values).
- `HabitAnalytics.tsx` — dashboard strip on the workspace: overall completion rate, weekly and monthly trend sparklines, active streaks, and today's pending count.

Shared helpers (`src/lib/habits.ts`):
- CRUD wrappers, streak calculation, completion-rate math, target-achievement math, "due today?" logic based on frequency + custom days, and a `getYesterdayValues(habitId)` helper.

## 4. Notifications / reminders

Client-side reminders using the Notifications API + `setTimeout` scheduled from reminder times for habits due today. If a reminder time has passed and the habit is still pending, we show a "Pending" pulse badge on the card and a summary count in the analytics strip. (No push infra — pure in-app, works while the tab is open. If you want true push later, we can add a service worker.)

## 5. UX

- Framer-motion enter animations, hover-scale cards, one-tap complete, optimistic updates via TanStack Query with cache invalidation, mobile-first responsive grid (1 / 2 / 3 columns), and semantic tokens only (no hardcoded colors).
- Zero changes to existing task, category, or workspace code beyond mounting the new `<HabitsSection />` below the tasks section on the workspace route.

## Technical Details

- Migration: `ALTER TABLE me_habits ADD COLUMN ...` (nullable / defaulted so existing rows keep working) + new `me_habit_fields` table + `ALTER TABLE me_habit_logs ADD COLUMN log_date date, values jsonb, completed boolean, notes text` with a unique index on `(habit_id, log_date)`.
- Charts: reuse `recharts` (already in the project).
- Route: new file `src/routes/_authenticated/habits.$habitId.tsx` for the summary page. Section on existing workspace route.
- Types: regenerated after migration approval before wiring the UI.

## Order of execution

1. Migration (schema + GRANTs + RLS + policies + trigger). ← awaits your approval
2. `src/lib/habits.ts` helpers.
3. Habit UI components + mount under My Workspace.
4. Summary route + analytics.
5. Reminders + pending badges.
