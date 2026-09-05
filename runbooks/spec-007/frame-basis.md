# Repair runbook — Frame basis acquisition (ZN-0042)

**Status:** implementation-in-progress; not accepted.

Scope: Bounded Frame basis acquisition under REPEATABLE READ.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
OBSERVE actual durable state at Frame builder boundary.
REPAIR: reopen REPEATABLE READ; rematerialize head/domain/rights/sparse/pins; never mix pre/post ingestion cuts.
VERIFY AC/NEG/BOUNDARY on real Postgres.
```

Notes:
- Snapshot TX closes before any unbounded/LLM work.
- Opaque refs without permission return NotFoundOrDenied with no existence leak.
- Profile row limits report incomplete rather than silent truncation.

SPEC-007 · `ontology.frames`, `ontology.frame_pins`, `ontology.frame_sparse_rows`.
