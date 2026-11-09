# Roadmap

## In progress
- [ ] LMS section: daily data upload (Name, Number, Email) with year tag 2020–2029
  - [x] DB: lms_leads table + can_lms permission + has_lms_access()
  - [x] Permission wiring: access.ts, auth.tsx, settings.users.tsx
  - [ ] Sidebar entry (LMS)
  - [ ] /lms page: add form, CSV bulk upload, year filter, search, edit/delete
  - [ ] Duplicate rule: skip row only when BOTH phone and email match an existing row; if only one matches, still add. Show skipped duplicates to the user.
  - [ ] Typecheck + verify in preview
