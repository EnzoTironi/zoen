# Testing and evidence policy

## Executed here

The exact result and source hashes are in `evidence/local-validation/core-report.json`. The suite exercises actual dependency-independent production modules compiled by the real TypeScript compiler available in the container. No database/policy/provider port is replaced with a fake to make a journey pass.

- Example-based and adversarial tests cover duplicates, malformed Unicode, bounded parsing, prototype/accessor behavior, date/time boundaries, exact decimals, result algebra, rights restrictions and state transitions.
- Seeded property/differential tests cover 2,000 canonical JSON values, 4,000 exact allocation cases and 2,000 date cases against a native UTC reference. These cases are inside named tests, not claimed as separate v4 acceptance checks.
- Native WebCrypto tests exercise actual SHA-256, HMAC and Ed25519. Selected hashes/HMACs are compared against the independent Node crypto API.
- Nine selected mutations alter copies of compiled production modules. A baseline must pass; invalid JS/import errors do not count as a caught mutation. Each selected valid semantic/security defect must produce assertion failures. This is not exhaustive mutation coverage and not a provider mock.
- Strict core type checking and AST grammar checks run separately. Static import/dependency guards are heuristics with an explicit scope, not a security proof.

## Not executed here

The target Node 24/TypeScript 6 full build; actual Cedar WASM calls; Better Auth signup/session handling; PostgreSQL migrations/transactions/RLS/outbox; AWS S3 operations; browser journeys; property-based concurrent DB histories; real crash/recovery, load, migration, restore or external provider gates.

The ten authored tests in `tests/real/vertical-slice.test.mjs` require real services. Missing prerequisites produce `blocked`, zero executed, and exit code 2. They never become skipped passes. After prerequisites exist, any failure in hooks, tests, authorization or cleanup makes the suite fail. Passing all ten would prove only that named candidate journey/profile, not the full v4.

## Commands and interpretation

| Command | Scope | Missing prerequisite |
|---|---|---|
| `node tooling/verify-core.mjs` | Core compilation, named laws/security tests, import rules and TS syntax | Nonzero; no compilation substitute |
| `node tooling/mutations.mjs` | Nine selected mutation regressions of current compiled core | Nonzero |
| `node tooling/preflight.mjs --real` | Target runtime/dependencies/lock/resource configuration checks | Exit 2, not a pass |
| `node --env-file=.env tooling/real-tests.mjs` | Actual real-service tests after build/migrations | Exit 2 before tests or nonzero real failure |
| `node --env-file=.env tooling/verify.mjs` | Core, target admission, full build and real suite | Nonzero when any layer is unavailable |

`verify-core` using the installed global compiler reports that exact version. It does not loosen the target preflight. An unqualified adapter is never hidden behind an offline branch.

## V4 evidence remains independent

All 975 v4 checks remain unrun. They are not aliases for these 72 local tests. No ticket is independently accepted. Source overlap is only navigation metadata, not evidence of completion. Preserve test commands, seed, source commit, dependency lock, infrastructure profile, raw logs and review identity when later claiming a ticket.

Current evidence is self-produced and hash-checked, not externally attested. A malicious author could fabricate artifacts; independent trusted CI/review remains necessary. Integrity checking detects changes relative to this bundle, not developer honesty.
