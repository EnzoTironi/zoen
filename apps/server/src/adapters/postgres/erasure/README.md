# Erasure controller adapters (ZA-11)

Local narrow profile wires:

- `ZOEN_ERASURE_ATTEMPT_DATABASE_URL` → separately scoped controller PostgreSQL
- `ZOEN_ERASURE_CONTROLLER_ANCHOR_PATH` → durable file anchor (`adapters/erasure/file-anchor.ts`) outside the controller data volume

Composition selects `anchoredLocalErasureAttemptRegisterLayer` only when the anchor path is set. Hosted/full independence stays fail-closed until H-01 and G-OPS qualify; `restoreAfterErasure` remains false.
