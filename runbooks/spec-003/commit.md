# ZN-0020 — serializable commits / sorted domain locks (repair)

```text
PRECHECK authority DB role, SERIALIZABLE support, ticket evidence.
OBSERVE ontology.domains versions, commits, receipts, jobs.outbox for the World.
PRESERVE committed receipts; never invent a mixed head after failed activation.
REPAIR: retry only serialization/deadlock with the same intent; do not refresh consent.
VERIFY independent-domain overlap, conflicting serialize, activateHead exclusivity.
```

Open gate: ZN-0024 chaos commit-boundary proof remains unfinished.
