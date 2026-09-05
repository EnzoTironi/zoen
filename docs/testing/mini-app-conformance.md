# Mini-app / human / agent conformance — product test plan

**Status:** all product checks unrun. This file specifies tests for the implementing repository. Package Python tests validate schema/catalog controls only. Test IDs and evidence layer are in [catalog](../../planning/check-map.json); requirement coverage is [R4](../backlog/v4-requirements.md).

## Equivalent-context oracle

Compare normalized semantic values before presentation: permitted facts/units/valid time, uncertainty and contestation, evidence refs, explanation refs, exact basis/cut/coverage, tagged outcomes, action consequence digest and stable receipt/intent identities. Normalize only transport request IDs, logging clocks and rendering/prose. Sort sets by semantic ID; preserve ordered results. Do not erase null/unknown, denial, missing fields, hidden-rival signals, stale state or financial rounding.

Equality requires the same subject/actor/delegation, audience, purpose, app ceiling, release/installation, exact data basis and source rights. Different roles are separate comparison classes. A negative control deliberately changes one context field and must invalidate an equivalence claim. Compare exact private-data exposure using paired Worlds that differ only in forbidden information.

An instrumented test-only dispatcher entry records an opaque implementation marker and handler digest. Every data-bearing path must hit the existing SPEC-007 executor and no forbidden repository path. The marker alone is insufficient: real query/mutation outcomes and import/credential isolation must also pass. No production fixture endpoint.

## Scenario matrix

| Case | Given / intervention | Required observable oracle | Minimum real evidence |
|---|---|---|---|
| APP-01 | Web, CLI, Eve and declarative app inspect two authorized conflicting deadlines at same cut | Same interpretation, rivals, units, evidence and basis, no model call for structured app read | PostgreSQL + current authorizer; browser journey |
| APP-02 | Add/remove a denied rival only | No visible difference in worker facts/counts/confidence/errors/discovery | Real policy/noninterference suite |
| APP-03 | Try top-level principal injection or hidden operation | Rejected before repository read; no authority from JSON | Real dispatcher component |
| APP-04 | Cross-surface retry with same operationId + intent | One local receipt/effect; current reauthorization on replay | PostgreSQL concurrent transactions |
| APP-05 | New relevant row after approval, including a previously absent predicate | Stale, no receipt/effect; no silent refreshed consent | PostgreSQL fault barrier |
| APP-06 | Same arguments, distinct operation IDs | No false claim of deduplication; domain policy still bounds duplicates | Real ActionCase handler |
| APP-07 | Forward private link to outsider | No membership or protected target metadata | Real Door + browser |
| APP-08 | Forward to already authorized person with different rights | Their own current view, never creator privileges | Real policy + browser |
| APP-09 | Preview GET/HEAD before open | Generic no-store landing; no challenge consumed or approval | HTTP/browser traces |
| APP-10 | Copy challenge across browsers or race POST redemption | Wrong binding denied; at most one valid consume; no CSRF/redirect bypass | Real sessions/DB/browser |
| APP-11 | Logout, history-back, new account on same device | Host clears controlled private views; no old authority | Browser/storage traces |
| APP-12 | Alter World, app, purpose, artifact or cursor binding | Rejected without protected existence metadata | Real executor/session components |
| APP-13 | Malicious sibling frame / stale frame / origin / nonce | No forward to executor or protected reply | Real browser MessagePort/iframe |
| APP-14 | Direct HTML/asset/source map/log/debug/API/upgrade | No private bytes or business bypass without current session | Deployed route inventory |
| APP-15 | Guest echoes forwarded request headers | No Cookie, Authorization, forged identity or secret | Real proxy/runtime |
| APP-16 | Owner then worker hit same logical app runtime | No owner globals/SQLite/cache/snapshot data in worker partition | Real runner with warm-state probes |
| APP-17 | Revoke before final send, queue flush, export download or resume | No newly authorized private payload; explicit closure/deny | Real policy + host/stream barriers |
| APP-18 | Provider accepts but loses response | Unknown until evidence; no app-local success or unsafe retry | Provider sandbox admission |
| APP-19 | Candidate builds/deploys internally but is not approved | Public app remains old admitted version | Actual Core + Ontology release |
| APP-20 | Head/rights change between runtime preparation and activation | Stale/denied; no publish by runtime side effect | Actual Core + PG faults |
| APP-21 | Restore old runtime / cache after recall | Current recall/epoch deny; no implicit rollback | Real runtime/host faults |
| APP-22 | Executable code requests protected data without disclosure profile | No protected data enters guest; trusted-renderer fallback | Real host/policy + browser |
| APP-23 | Approved code attempts data exfil by self-navigation | Report actual browser limitation; managed-egress claim only with actual external enforcement | Browser/network profile review |
| APP-24 | Unsupported MCP host/dialect/capability | Safe structured text or protected link, no token leak or weaker auth | Actual supported host + protocol peer |
| APP-25 | 200-row multi-widget query/export under load | Bounded query/row/memory cost; exact authorized basis; quota/backpressure explicit | Measured workload profile |
| APP-26 | App publishes reusable rule from one local correction | No implicit global rule; separate DefinitionChange approval required | Real release/interpretation journey |
| APP-27 | Guest sends approved=true or different consequence | Host confirmation + Case semantics prevail; no commit from UI assertion | Real browser + ActionCase |
| APP-28 | Background task resumes after human session ends | Explicit workload/delegation required; no stolen ambient session | Real job/lease boundary |

## Synthetic fixtures and precise expected outcomes

`fixtures/v4/` contains three display examples and the finite adversarial catalog. Example bakery inputs: production quantity 12, two comparable deadlines 2026-09-10 and 2026-09-11, money 480.00 BRL visible only to owner. Both known deadline claims remain unresolved unless a released selection rule is present. Worker view excludes price and money-derived counts. A hospital/clinic fixture separates appointment identity from medical narrative. Enterprise fixture distinguishes booked 1000, invoiced 800 and received 600 as **different concepts**, not a forced conflict.

All values are synthetic. Reference state fixtures support package shape tests only; real integration suites seed equivalent records through ordinary admitted operations. Tests may not patch the database to hide an invalid authority transition. Fault harnesses use test-only barriers, not production backdoors.

## Failure injection and timing

Named barriers: before final disclosure; after slot creation/before attestation; after release preparation/before activation; before read-guard check; after local commit/before external attempt; after provider acceptance/before acknowledgement; before chunk download; after recall/before cache refresh; before warm-state lease handoff. Record seed, commit, lock, clock, profiles and exact barrier.

Revocation claim is ordered at the final server disclosure check. Already linearized/in-flight bytes and user copies cannot be recalled. Test both orders instead of inventing absolute network-time secrecy. Memory/CPU exhaustion must terminate externally; test host availability and post-kill lease behavior, not only guest error handling.

## Workload W-APP (proposed, unmeasured)

Synthetic dataset: 10,000 orders, 50 attributes, 3 source families, 10% genuine comparable conflicts and 20% records/fields hidden for the worker. 100 simultaneous sessions, 200-row pages, up to 6 widgets sharing a Frame, 5 user operations/minute/session; independent export up to 10,000 rows. Separate exploratory high-density profile increases these dimensions only after admission.

Initial candidate targets: p95 admitted read roundtrip <1 second in the deployment region, p95 first authorized app content <2.5 seconds after an existing valid session, page response <=1 MiB, at most 20 subplans per batch and no per-cell RPC. These are design objectives, not benchmark results or contractual SLAs. Report actual client/region/network, server shape, cold/warm state, concurrency, db queries, source rights selectivity, model calls (zero for structured reads), RAM/CPU, egress, error rate and cost. Missing/failed target yields an unadmitted profile, not a fake performance claim.

## Evidence and admission

Every ticket needs its AC, NEG and BOUNDARY checks at the declared layer, no skipped tests. Browser automation is not a provider sandbox. Protocol simulation is not real Core/runner isolation. Backend authority and browser DLP are separate claims. Record residual risks of reviewed executable disclosure and never claim no egress merely because CSP exists.

Run an independent review for all v4 critical boundary changes. Change to release grammar, rights, browser origin/CSP, vendor version, bridge protocol, publication mapping or runtime partition reopens dependent evidence. Generated backlog and preserved v3 history do not constitute a signoff.
