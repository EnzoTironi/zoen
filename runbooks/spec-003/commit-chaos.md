# Commit-boundary chaos repair — ZN-0024

**Status:** implementation-in-progress; chaos profile not production-qualified. Ticket unaccepted.

```text
PRECHECK ZOEN_TEST_DATABASE_URL, ability to SIGKILL child processes, and disposable PG namespace.
OBSERVE ontology.operations/commits/receipts + jobs.outbox row counts after each kill.
NEVER fake process death with try/catch stubs; require real SIGKILL at PG advisory-lock barriers.
IF the environment cannot block a real authority child at a named barrier: report MissingPrerequisite / BLOCKED.
VERIFY: after kill, either no semantic commit or the complete receipt/domain/outbox set exists exactly once.
RESUME only after independent review; do not mark accepted.
```

Barriers exercised: `before_domain_write`, `before_outbox`, `after_outbox_before_commit` via real PostgreSQL triggers + `pg_advisory_xact_lock`, then SIGKILL of the Node authority child.
