# Architecture

- Invoice numbering uses a shared type-aware helper: retain the legacy tax prefix, allocate proformas in a separate PF series, and preserve saved numbers during reclassification so issued references remain stable.

- Document completeness uses a shared category-based helper across institution groups; unsigned legacy MOUs never satisfy signed-MOU requirements, and existing invoice categories remain compatible.

- Accounts TDS records use a dedicated Accounts-access-controlled store and reuse client names plus previously entered TDS company names for selection; TDS entries do not change cash balances or expenses without an explicit accounting requirement.
- GST wallet reuses existing invoice/payment/income GST flags and shared eligibility/aggregation helpers; invoice type gates invoice and linked-payment GST, GST-enabled invoices cover linked payments to prevent double-counting, and previous-payment selection never creates new cash entries.
- LMS lead filters use database-side relationship joins before counting and pagination, with a shared query builder and focused filter controls; never download all matching lead IDs for tag filtering because datasets can be large.