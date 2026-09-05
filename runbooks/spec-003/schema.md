# ZN-0019 — schema migration discipline (repair)

Scope: owner-scoped SQL schema and expand/backfill/validate/contract ledger.

```text
PRECHECK migrator credential, ZOEN_ALLOW_SCHEMA_MIGRATIONS, PostgreSQL 18, ticket evidence.
STOP new authority admissions for the affected World/realm before ambiguous repair.
OBSERVE ontology.schema_migration_ledger phases and zoen_migrations (numbered) state.
PRESERVE applied digests; never rewrite sha256 of an applied phase.
REPAIR forward: resume missing phases with identical SQL bytes; do not roll back dataful contract steps.
VERIFY ZN-0019-AC/NEG/BOUNDARY on disposable Postgres with SET ROLE probes.
RESUME only after runtime roles still deny DDL and progress cannot write authority rows.
```

Open gate: ZN-0024 chaos commit-boundary proof remains unfinished on this stack.
