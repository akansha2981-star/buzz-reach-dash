# Architecture

- Accounts TDS records use a dedicated Accounts-access-controlled store and reuse client names plus previously entered TDS company names for selection; TDS entries do not change cash balances or expenses without an explicit accounting requirement.
- LMS lead filters use database-side relationship joins before counting and pagination, with a shared query builder and focused filter controls; never download all matching lead IDs for tag filtering because datasets can be large.