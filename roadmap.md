# Roadmap

- [ ] LMS advanced filters: tags/categories, source/year/dates, ascending/descending sorting, missing-field filters without deleting records; verify.

## In progress
- [ ] LMS section: daily data upload (Name, Number, Email) with year tag 2020–2029
  - [x] DB: lms_leads table + can_lms permission + has_lms_access()
  - [x] Permission wiring: access.ts, auth.tsx, settings.users.tsx
  - [ ] Sidebar entry (LMS)
  - [ ] /lms page: add form, CSV bulk upload, year filter, search, edit/delete
  - [ ] Duplicate rule: skip row only when BOTH phone and email match an existing row; if only one matches, still add. Show skipped duplicates to the user.
  - [x] Typecheck + verify in preview (add / duplicate-block / partial-match verified via Playwright)
- [x] LMS tagging system: manual tag categories, multiple tags per category, multiple tags per data entry
  - [x] DB: lms_tag_categories, lms_tags, lms_lead_tags + RLS
  - [x] UI: manage categories/tags, assign multiple tags to entries, filter by tag
- [x] FIX: preview hydration broken sandbox-wide ("can't detect preamble") — fixed with dev-only preamble stubs in __root.tsx head
- [ ] LMS advanced dashboard: total leads, source-wise, tag-wise, daily/weekly/monthly averages, cumulative chart; server-side counts so it scales to 10 lakh leads (pagination + count queries, not full-table fetch)
- [ ] Bulk tag system: upload list of emails, pick category + tag, apply to all matching leads; sample categories/tags in the CSV template
