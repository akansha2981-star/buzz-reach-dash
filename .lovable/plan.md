# HRMS Module — Phased Build Plan

Adding a full HR Management System under `/hrms` in this app, sharing auth and users with the existing outreach CRM. Skipping geo/face/SMS/2FA for now.

This is a large module — I'll ship it in **3 phases** so each phase is reviewable and the app stays working between drops.

---

## Phase 1 — Foundation, Employees, Attendance, Leave (this turn)

**Database (one migration)**
- `hr_employees` — employee_code, full_name, email, phone, department, designation, reporting_manager_id, joining_date, employment_type (employee/intern), status (active/suspended/inactive), profile linked to `auth.users`
- `hr_departments` — name, head_id
- `hr_roles_assignments` — extends current `user_roles` with HR-specific roles (super_admin, hr_admin, manager, team_leader, employee, intern) via a new enum value path; uses existing `has_role()` helper
- `hr_attendance` — employee_id, date, clock_in_at, clock_out_at, total_break_minutes, total_work_minutes, status (present/absent/half_day/late/wfh), notes
- `hr_breaks` — attendance_id, start_at, end_at
- `hr_leave_types` — code, name, default_quota, color, requires_doc
- `hr_leave_balances` — employee_id, leave_type_id, year, allocated, used
- `hr_leave_requests` — employee_id, leave_type_id, from_date, to_date, days, reason, status (pending/manager_approved/approved/rejected/cancelled), manager_id, manager_decision_at, hr_id, hr_decision_at, document_path
- `hr_holidays` — date, name, region
- `hr_documents` — employee_id, category (Aadhaar/PAN/Offer Letter/Salary Slip/Certificate/Other), name, file_path
- All tables RLS-enabled. Policies: employee sees own; manager sees their reports; HR/super_admin sees all.
- Storage bucket `hr-docs` (private) with signed-URL access.

**Routes & UI**
- `/hrms` — Employee dashboard (welcome card, today attendance, leave summary, quick actions, announcements feed)
- `/hrms/attendance` — Clock in/out widget, today's timeline, monthly calendar grid, my attendance history table with filters
- `/hrms/leaves` — Apply leave (form + doc upload), my requests, balance cards, holiday calendar
- `/hrms/employees` — Directory (HR/admin only) with search + department/role/status filters; add/edit/suspend/activate
- `/hrms/employees/$id` — Profile detail (personal, emergency, address, bank, documents tab)
- `/hrms/admin/leaves` — Pending approvals queue (manager + HR views)
- `/hrms/admin/attendance` — Org-wide attendance (daily/weekly/monthly, by employee, by department)

**Sidebar**
- New "HR" section added to `AppSidebar` with permission gating (only shown if user is in `hr_employees`).

---

## Phase 2 — Productivity, Tasks, Announcements (next turn)

- `hr_work_logs` — daily logs with productivity score
- `hr_tasks` — assigned by manager, status, files, notes
- `hr_announcements` — title, body, priority, pinned, target_dept, posted_by
- `hr_announcement_reads` — read receipts
- Routes: `/hrms/productivity`, `/hrms/tasks`, `/hrms/announcements`
- Charts: working-hours trends, productivity over time, attendance consistency heatmap

## Phase 3 — Analytics, Reports, Polish (third turn)

- `/hrms/analytics` — KPI cards, attendance % heatmap, leave usage by type, department analysis
- Exportable reports (CSV)
- Audit log viewer (uses existing `audit_logs`)
- Auto-logout on inactivity (idle timer in `AppShell`)
- Login activity tracking table
- Real-time updates via Supabase realtime on key tables

---

## Tech notes

- Reuses existing auth (`useAuth`), shadcn UI, TanStack Query patterns from current app — no new framework deps.
- Uses existing `has_role()` security definer + new `is_hr_admin()` / `is_manager_of()` helpers.
- Charts via `recharts` (already in repo).
- Mobile-first; reuses `MobileBottomNav` pattern with HR-aware items when `/hrms/*` is active.

After you approve, I'll execute Phase 1 in this turn (one migration + ~12 files).