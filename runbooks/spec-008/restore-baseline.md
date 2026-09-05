# Repair runbook — backup/restore disposable baseline (ZN-0049)

**Status:** implementation-in-progress; not accepted.

Scope: Back up authority + retained evidence; restore into a separate namespace with deny-all outbound dispatch; replay deletion suppression before reads.

```text
PRECHECK disposable source and restore namespaces; never restore over a live unknown tenant.
BACKUP receipts, object pins, deletion ledger and pending effects.
RESTORE with dispatch_enabled=false and new workload credentials/namespace.
REPLAY deletion suppression before any user read.
ASSERT deleted artifacts stay undisclosed; pending effects do not send; missing refs marked unavailable.
RESTORE admission requires deletionCut + effectLedger via ReadinessService.
```

SPEC-008 · chaos restore baseline.
