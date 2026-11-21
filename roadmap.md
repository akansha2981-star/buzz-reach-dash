# Roadmap

- [x] Invoice types: required Tax/Proforma choice, dedicated PDF headings, bulk classification of previous invoices, GST exclusion; 15 GST/TDS tests passed.
- [x] Verify invoice classification and GST totals in a signed-in session: created both types, verified PDF labels, bulk-marked both as tax then proforma, confirmed GST wallet counts 1 → 2 → 0; temporary invoices removed.

- [x] Documents: institution-wise college/coaching groups, mandatory-document checklist and closed-institution warnings; nine tests passed, preview compiled.
- [ ] Documents signed-in desktop/mobile verification — blocked: no account matches the requesting user's email; preview redirects to login.

- [x] GST wallet: previous payment selection, automatic inclusion of GST-marked payments/income, no duplicate invoice GST; eight tests passed and preview compiled.
- [ ] Verify GST wallet selection/persistence with real payments — blocked: no matching requesting-user account; preview redirects to sign-in.

- [x] LMS advanced filters: combined tags/categories, source/year/dates, ascending/descending sorting, missing-field filters without deleting records; six filter tests passed and preview compiled.
- [ ] Verify LMS filters against signed-in lead data on desktop/mobile — blocked: requesting user has no matching account available for automatic sign-in; preview opens login.

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
