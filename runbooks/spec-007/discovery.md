# Repair runbook — authorized discovery (ZN-0044)

**Status:** implementation-in-progress; not accepted.

Scope: Authorized discovery and explanation references under current rights and source ACL freshness.

```text
PRECHECK membership role, security revision and source ACL freshness.
FILTER operations and fields under current rights; owner-only clinical fields stay hidden from viewers.
GENERATE descriptions and evidence deep links only from authorized released metadata.
OPAQUE denial: missing and unauthorized explanation refs are identical NotFoundOrDenied.
VERIFY AC/NEG/BOUNDARY on real Postgres (receptionist vs clinician).
```

SPEC-007 · `DiscoveryService` · `SemanticExecutor.discover`.
