# Architecture

- Accounts TDS records use a dedicated Accounts-access-controlled store and reuse client names plus previously entered TDS company names for selection; TDS entries do not change cash balances or expenses without an explicit accounting requirement.
- GST wallet reuses existing invoice/payment/income GST flags and a shared aggregation helper; GST-enabled invoices cover their linked payments to prevent double-counting and previous-payment selection never creates new cash entries.
- LMS lead filters use database-side relationship joins before counting and pagination, with a shared query builder and focused filter controls; never download all matching lead IDs for tag filtering because datasets can be large.