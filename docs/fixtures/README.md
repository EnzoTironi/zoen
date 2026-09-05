# Synthetic fixture contract

[oracles.json](oracles.json) contains 16 hand-authored exact cases. They are inputs/expected outcomes to implement through normal product paths, not claims that a product currently produces them. Use generated opaque IDs and explicit World/realm/rights when loading. Do not use real personal, clinical or licensed market data without its gate.

- `FX-001` — Grandmother bill is asserted paid, not externally verified
- `FX-002` — Bakery order revision and received deposit
- `FX-003` — Corporate metrics are not false conflicts
- `FX-004` — Copied source families
- `FX-005` — Predicate phantom after consent
- `FX-006` — Root budget conservation
- `FX-007` — Lost reply after provider acceptance
- `FX-008` — Hidden rival noninterference
- `FX-009` — Changed activation basis
- `FX-010` — Iceberg exact snapshot and retention
- `FX-011` — Old turn fence loses settlement race
- `FX-012` — Federated local approval mismatch
- `FX-013` — Order fill and bust conservation
- `FX-014` — Expired offline scope
- `FX-015` — Local correction is not a reusable rule
- `FX-016` — Fencing unavailable during cell partition

Maintain scope, conflicting/hidden data and exact numerical expectations when adding records for scale. A benchmark cannot remove these cases to improve latency. Additional per-ticket fixtures live in that ticket’s allowed test fixture path. Seed controls are test-composition only, never public production routes.

## v4 mini-app examples

The [validation index](v4/validation-index.json) selects six synthetic, shape-valid examples for the app, link, session and bridge schemas. [Mini-app conformance](../testing/mini-app-conformance.md) supplies exact scenario oracles. Schema validation is not proof that a real user is authorized or that a real runtime is isolated.
