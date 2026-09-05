# Capture GC repair — ZN-0029

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK capture locks, retention_pins, pending_admission, upload_lease_expires_at.
OBSERVE GC rechecks state after FOR UPDATE; admitted/pinned/pending survive.
DELETE only expired unadmitted orphans with no pin and no pending admission.
VERIFY no ontology.evidence / source_admissions row points at GC-deleted bytes.
RESUME only after independent review.
```
