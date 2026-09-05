# Repair runbook — frame disclosure (ZN-0046)

**Status:** implementation-in-progress; not accepted.

Scope: Reauthorize before delivery; historical reopen returns SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable.

```text
PRECHECK membership, source ACL and retention/erasure state.
REOPEN retained frames only after fresh rights recheck.
NEVER silently refresh a pinned basis when head/rights advanced.
ERASED/expired evidence => HistoricalContentUnavailable (no payload).
```

SPEC-007 · `FrameDisclosureService`.
