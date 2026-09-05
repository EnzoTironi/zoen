# Repair runbook — readiness, admission flags and graceful drain (ZN-0048)

**Status:** implementation-in-progress; not accepted.

Scope: Distinguish liveness from readiness; fail on incompatible migrations/locks/roles; unadmitted providers are explicit `disabled`; drain admitted requests and release fenced jobs once per epoch.

```text
PRECHECK migrations, locks, roles and admitted capability flags.
QUERY Health() for liveness; Readiness() for AdmittedDependencies.
NEVER report unadmitted effect providers as healthy — use disabled.
ON shutdown: beginDrain → complete in-flight → releaseFencedJobs (dispatch_enabled=false, epoch bump) → no duplicate semantic result.
RESTORE admission requires deletion ledger + effect ledger; otherwise Blocked.
VERIFY core file-path remains usable while effects are explicitly unavailable.
```

SPEC-008 · `ReadinessService`.
