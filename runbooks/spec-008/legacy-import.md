# Repair runbook — non-destructive legacy import (ZN-0050)

**Status:** implementation-in-progress; not accepted.

Scope: Versioned manifests for legacy data/meaning/rights; evaluation-only rehearsal; never auto-grant administrator; never mutate OS production.

```text
PRECHECK evaluation realm and disposable namespaces.
RECORD versioned manifest (commit, counts, rights mapping, unmatched, diffs).
REHEARSE import through normal admission — do not copy old membership blindly.
NEVER auto-grant broad administrator roles.
REPORT all discrepancies for owner approval before any cutover.
ASSERT OS production marker remains unchanged.
```

SPEC-008 · `LegacyImportService`.
