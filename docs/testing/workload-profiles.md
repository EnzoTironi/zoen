# Reproducible workloads and proposed release budgets

These are initial test-design targets, not measured performance claims, price promises or customer SLAs. Each admission records actual machine/region/database settings, component versions, source shapes, rights selectivity, cold/warm state, seeds and provider latency. A target change requires reviewed rationale; a model cannot reduce load until a test passes.

| Profile | Synthetic scope | Required load | Initial non-provider target |
|---|---|---|---|
| P0 file/web proof | 10 Worlds; 1,000 claims each; 10% comparable conflicts; 20% forbidden evidence | 5 concurrent users, 1 mutation/s, 5 reads/s for 15 minutes | No invariant violations; inspect p95 ≤ 1 s, commit p95 ≤ 500 ms on recorded baseline hardware. |
| P1 hosted personal | 1,000 Worlds; 10,000 claims each; skewed active set; 5 connected sources/World | 100 concurrent sessions, 100 reads/s, 20 mutations/s; 2 h steady + 10 min 3× burst | Inspect p95 ≤ 1.5 s, trusted mutation p95 ≤ 750 ms; zero cross-tenant disclosure; bounded backlog that drains after burst. |
| P2 professional | 100 businesses; 250,000 claims each; 25 users/business; 10% shared predicates | 250 reads/s, 50 mutations/s, 100 ingested records/s; 2 h + outage/recovery | Same trust laws; inspect p95 ≤ 2 s; commit p95 ≤ 1 s; unresolved coverage visible; document actual cost per useful result. |
| P3 dedicated institutional cell | 10M sparse objects, 100M claims, 1B dense rows; skewed rights/domains; 500 active users | 1,000 reads/s, 200 mutations/s, 10,000 dense events/s; 4 h + partition/restore | No correctness waiver. Point lookups p95 ≤ 2 s; ordinary domain commit p95 ≤ 1 s; explicitly bounded scan plans. Larger analytics have declared asynchronous deadlines. |
| P4 multi-cell / finance | ≥3 cells; independent cuts; duplicated/out-of-order quotes/orders; actual licensed provider test/replay stream, with captured input provenance; not a substitute provider | 24 h mixed load + gap, provider outage, replay, migration and stale-leader attempts | Zero forbidden concurrent writers, fabricated settlements or conservation failures. Report actual event-to-admitted/captured latency distribution and recovery envelope. |

Model generation, source APIs and WhatsApp delivery are measured separately from semantic execution. No “chat response SLA” hides those external components. For streaming, measure time to durable ingress, first useful response, settled reply and delivery observation separately. Acknowledgement latency and finished work are different metrics.

Consumer accessibility checks include keyboard-only use, screen reader, 200% zoom, high text density, voice confirmation and shared-device logout. Professional checks include confusing patient/customer identities and overlapping capacity. Institutional checks include sparse/denied result sets, hot predicate contention, mass revocation and projection lag.

Pilot recovery starts with a proposed RPO ≤ 24 h and RTO ≤ 4 h for the stated small profile, before any stronger promise. Institutional target proposals start at RPO ≤ 5 min and RTO ≤ 60 min for the admitted regional profile. Measure end-to-end restored *semantic* readiness, including erasure suppression and escaped effects, not merely database startup. Customer requirements may be stronger and require a separate test/capacity amendment. RPO/RTO targets are not operational evidence.

A benchmark fails if assertions were disabled, fixtures lost denied/conflicting cases, a required capability was silently off, the queue grows without bound, cost attribution omits a dependency, or the report conceals errors behind percentiles. Keep raw counts and denominator definitions. Production scale is profile admission, not extrapolation from P0.

## W-APP — mini-app workload profile

[Mini-app conformance](mini-app-conformance.md) defines proposed batched-read, dashboard, stream and export loads. Targets are hypotheses until the exact profile is measured. No latency, cost, isolation or enterprise-scale result is supplied by this package.
