# SPEC-048 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-048](../specs/spec-048.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Architecture and Operations**. Module: `journeys/acceptance`. Milestone: **S11**.

## Normative operation signatures

```text
EvaluateReleaseCandidate(commit,profile) -> AcceptanceReport; CheckCapabilityCoverage(requirements,evidence) -> Covered|Missing; PromoteOperatingProfile(report,approvals) -> Admitted|Blocked.
```

## State and transaction contract

No new product authority store. evidence/release-candidates/<commit> contains immutable reports, dependency locks, requirement/test coverage, threat findings, workload certificates, user-study evidence, provider qualifications, unresolved deviations and sign-off records. The current capability support matrix is derived from accepted evidence, not manually edited success flags.

## Shared algorithm

```text
ENUMERATE every required capability/ticket/check and current operating admission for the release candidate.
RUN shared invariant journeys across consumer, professional and institutional fixtures on real admitted components.
EXERCISE hostile inputs, crashes, recovery, revocation, erasure, load, cost and upgrade boundaries at final profile.
INCLUDE cross-surface mini-app equivalence and provider/runtime/source licensing gates.
BIND each result to exact commit, lock, configuration, source rights, seed/workload and immutable raw evidence.
REJECT zero/omitted/skipped checks, inherited incompatible evidence, self-review and invented performance.
PROMOTE only supported scopes after independent sign-off; unresolved routes remain disabled.
REOPEN affected qualification after material code/policy/artifact/provider/profile changes; files and plans are never completion evidence.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0281](../tickets/zn-0281.md) | Run the consumer complete-life-administration acceptance | [tests/journey/spec-048/consumer-capstone.test.ts](../../tests/journey/spec-048/consumer-capstone.test.ts) |
| [ZN-0282](../tickets/zn-0282.md) | Run professional operations and clinic-separation acceptance | [tests/journey/spec-048/professional-capstone.test.ts](../../tests/journey/spec-048/professional-capstone.test.ts) |
| [ZN-0283](../tickets/zn-0283.md) | Run enterprise institutional and finance acceptance | [tests/journey/spec-048/enterprise-capstone.test.ts](../../tests/journey/spec-048/enterprise-capstone.test.ts) |
| [ZN-0284](../tickets/zn-0284.md) | Run hostile-agent, supply-chain and privacy campaigns | [tests/chaos/spec-048/adversarial-campaign.test.ts](../../tests/chaos/spec-048/adversarial-campaign.test.ts) |
| [ZN-0285](../tickets/zn-0285.md) | Audit every capability and test evidence against the candidate | [admissions/spec-048/coverage-audit.json](../../admissions/spec-048/coverage-audit.json.plan.md) |
| [ZN-0286](../tickets/zn-0286.md) | Approve the fully qualified product support matrix | [admissions/spec-048/final-promotion.json](../../admissions/spec-048/final-promotion.json.plan.md) |

## Required proof boundaries

Run the same core invariants across consumer, professional and institutional Worlds. Add long-running chaos, upgrade/recovery, revocation, data erasure, cost and abuse workloads. Reuse approved primitives, never customer forks. Every unresolved unknown is scoped and disables affected routes. Reopen evidence when code, fixture, policy, provider API, dependency or operating profile changes materially.

V4 refinement: Final acceptance includes SPEC-055 cross-surface capstones and all v4 requirement checks. A browser/runtime qualification cannot be inferred from package-control tests or transport simulations.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
