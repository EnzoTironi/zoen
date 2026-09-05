# Implementation status and known limits

**Overall: partial implementation candidate. Full application unbuilt; no accepted v4 tickets; no production qualification.**

The Git history and file hashes establish what code was delivered. They do not establish semantic correctness. `evidence/summary.json` separates tests that ran from source awaiting real dependency verification.

| Area | Source present | Evidence in this delivery | Remaining work |
|---|---|---|---|
| Values / canonicalization / arithmetic / time | Strict TypeScript implementations | Core compiler and deterministic, property and adversarial tests | Target compiler admission, independent review, full supported-domain coverage |
| Claims / interpretations | Attribution, semantic comparability, disagreements, family/derivation grouping, scoped correction rules | Pure-law tests | Real-source acquisition, full identity resolution, stewardship, release-aware rules |
| Shared semantic path | One executor and ten handler implementations | Strict core compilation and static import rules | Real HTTP/auth/DB qualification; complete shared ABI, discovery schemas, batching/search/subscription/export |
| Authority | Real SQL transaction logic, conservative read guards, receipts, idempotency, outbox lease code | Law tests for guards/states only | PostgreSQL execution, full crash matrix, restore, concurrent rights barriers and throughput |
| Storage | SQL schema/migration/provision source, real pg and AWS S3 adapters | Grammar inspection only for external adapters; SQL not executed | Actual migration/role/upgrade tests, retention/erasure, IAM, backup/restore |
| Authentication / policy | Real Better Auth and Cedar WASM source | Syntax only; no authenticated service started | Full compile, schemas, real session/Cedar tests, SSO/step-up/delegation |
| HTTP / CLI | Thin Hono edge and shared client | Client/HTTP-boundary core compilation and adversarial helper tests | Live service tests, accessible browser experience, CLI usability |
| Runtime variation | Bounded pure expression interpreter and declared foundation | Pure component tests | Whole release compiler, preparation/evaluation/approval/activation; no runtime rule publication yet |
| Apps / secure links | Read-only manifest validation and session/capability restriction laws | Pure tests | Persistent sessions/links, real renderer, isolated host/bridge, sharing and Rivet/MCP qualification |
| External actions | Selected state-transition laws | Pure law tests | ActionCases, approvals, real effects, settlement, mandates and operating gates |
| Remaining S1–S11 | Preserved specs and tickets, not implementations | None | Implement the full backlog |

## Deliberate fail-closed limits

- Only the image-bound foundation release is loaded. A World with a different release returns `ContractChanged`, after current authorization. This prevents old code from pretending to execute a new definition; it is not a runtime-release implementation.
- App-session requests are blocked. Link/session helpers are not evidence of protected app hosting.
- Only small UTF-8 text/JSON evidence can be staged and reopened. The original text is retained; unsupported PDF/media extraction is not faked.
- Password accounts do not prove email ownership. No mailbox-based invitation, organization joining or financial authorization is exposed.
- The service binds to loopback and has no qualified hosted profile. It has no chat UI or default demo identity.
- Source visibility is only `shared` or `owner-only`. Attribute-level/disclosure-lattice policy, source ACL sync and revocation-stream guarantees remain work.
- The foundation is a generic `record` type with a few properties. There is no consumer/bakery/dental/enterprise product pack implementation.

## Engineering risks the next reviewer must address

The real library APIs and complete TypeScript build have not been checked with installed dependencies. SQL has not been parsed/executed by PostgreSQL. Real tests may reveal defects requiring code changes.

The `sources` guard domain is deliberately conservative and participates in claims operations. It can serialize unrelated writes and stale more decisions than a mature domain compiler should. Do not assert institution-scale concurrency from the primitive guard tests.

Evidence upload happens outside SQL, then metadata is admitted. Orphan upload recovery, quota accounting, exact cost attribution and retention-safe cleanup are not complete. Stored Frame expiry is bounded, but erasure/hold/restore lifecycle is not implemented. Final reauthorization exists for reads; fully specified concurrent dispatch/revocation barriers and stream shutdown are not proved.

The operation registry references schema IDs but does not yet publish a complete generated runtime schema/discovery system. There are no generated SDKs for evolving definitions. Read-only snapshots can persist audit/Frame materialization; they are not SQL `READ ONLY` transactions.

The v4 target includes strict workspace/quality/CI profiles, independent approval and 975 product checks. Current native tests and static guardrails are useful partial evidence, not substitutes for that profile. No 325-ticket completion percentage is asserted.
