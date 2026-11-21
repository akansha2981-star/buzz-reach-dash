# Architecture

- Invoice PDFs resolve client GSTIN from the shared client directory for both existing and new documents; downloads refresh client details, and ambiguous legacy name matches must not guess a GSTIN.

- Accounts financial views share invoice-accounting eligibility for invoices and linked payment/TDS rows; Proformas remain document-only without deleting historical records, and legacy unclassified invoices retain non-GST accounting treatment.

- Invoice numbering uses a shared type-aware helper: retain the legacy tax prefix, allocate proformas in a separate PF series, and preserve saved numbers during reclassification so issued references remain stable.

- Document completeness uses a shared category-based helper across institution groups; unsigned legacy MOUs never satisfy signed-MOU requirements, and existing invoice categories remain compatible.

- Accounts TDS records use a dedicated Accounts-access-controlled store and reuse client names plus previously entered TDS company names for selection; TDS entries do not change cash balances or expenses without an explicit accounting requirement.
- GST wallet reuses existing invoice/payment/income GST flags and shared eligibility/aggregation helpers; invoice type gates invoice and linked-payment GST, GST-enabled invoices cover linked payments to prevent double-counting, and previous-payment selection never creates new cash entries.
- LMS lead filters use database-side relationship joins before counting and pagination, with a shared query builder and focused filter controls; never download all matching lead IDs for tag filtering because datasets can be large.