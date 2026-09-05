# SPEC-048 — Full-ambition integration, adversarial assurance and final acceptance

**Milestone:** S11 · **Owner:** Architecture and Operations · **Root:** `journeys/acceptance`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Final completion is the conjunction of traced capability tests, integrated audience outcomes, admitted operating profiles and explicitly accepted external gates. A green backlog validator proves plan integrity, not implemented product correctness. No reduced demo can close the full-ambition milestone.

## Owned state and storage contract
No new product authority store. evidence/release-candidates/<commit> contains immutable reports, dependency locks, requirement/test coverage, threat findings, workload certificates, user-study evidence, provider qualifications, unresolved deviations and sign-off records. The current capability support matrix is derived from accepted evidence, not manually edited success flags.

## Operations

```text
EvaluateReleaseCandidate(commit,profile) -> AcceptanceReport; CheckCapabilityCoverage(requirements,evidence) -> Covered|Missing; PromoteOperatingProfile(report,approvals) -> Admitted|Blocked.
```

## Execution protocol
Run the same core invariants across consumer, professional and institutional Worlds. Add long-running chaos, upgrade/recovery, revocation, data erasure, cost and abuse workloads. Reuse approved primitives, never customer forks. Every unresolved unknown is scoped and disables affected routes. Reopen evidence when code, fixture, policy, provider API, dependency or operating profile changes materially.

V4 refinement: Final acceptance includes SPEC-055 cross-surface capstones and all v4 requirement checks. A browser/runtime qualification cannot be inferred from package-control tests or transport simulations.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-048](../algorithms/spec-048.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0281](../tickets/zn-0281.md) | Run the consumer complete-life-administration acceptance | journey | [ZN-0218](../tickets/zn-0218.md), [ZN-0235](../tickets/zn-0235.md), [ZN-0244](../tickets/zn-0244.md), [ZN-0259](../tickets/zn-0259.md), [ZN-0279](../tickets/zn-0279.md) |
| [ZN-0282](../tickets/zn-0282.md) | Run professional operations and clinic-separation acceptance | journey | [ZN-0281](../tickets/zn-0281.md) |
| [ZN-0283](../tickets/zn-0283.md) | Run enterprise institutional and finance acceptance | journey | [ZN-0282](../tickets/zn-0282.md) |
| [ZN-0284](../tickets/zn-0284.md) | Run hostile-agent, supply-chain and privacy campaigns | chaos | [ZN-0283](../tickets/zn-0283.md) |
| [ZN-0285](../tickets/zn-0285.md) | Audit every capability and test evidence against the candidate | admission | [ZN-0001](../tickets/zn-0001.md), [ZN-0002](../tickets/zn-0002.md), [ZN-0063](../tickets/zn-0063.md), [ZN-0069](../tickets/zn-0069.md), [ZN-0074](../tickets/zn-0074.md), [ZN-0095](../tickets/zn-0095.md), [ZN-0128](../tickets/zn-0128.md), [ZN-0140](../tickets/zn-0140.md), [ZN-0168](../tickets/zn-0168.md), [ZN-0179](../tickets/zn-0179.md), [ZN-0201](../tickets/zn-0201.md), [ZN-0217](../tickets/zn-0217.md), [ZN-0224](../tickets/zn-0224.md), [ZN-0230](../tickets/zn-0230.md), [ZN-0236](../tickets/zn-0236.md), [ZN-0243](../tickets/zn-0243.md), [ZN-0260](../tickets/zn-0260.md), [ZN-0266](../tickets/zn-0266.md), [ZN-0272](../tickets/zn-0272.md), [ZN-0280](../tickets/zn-0280.md), [ZN-0284](../tickets/zn-0284.md), [ZN-0290](../tickets/zn-0290.md), [ZN-0301](../tickets/zn-0301.md), [ZN-0312](../tickets/zn-0312.md), [ZN-0313](../tickets/zn-0313.md), [ZN-0319](../tickets/zn-0319.md), [ZN-0325](../tickets/zn-0325.md) |
| [ZN-0286](../tickets/zn-0286.md) | Approve the fully qualified product support matrix | admission | [ZN-0285](../tickets/zn-0285.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `capability-horizon.md`, `ambition-audit.md`, `testing-and-ci.md`. Read a named historical reference only when needed; it cannot override current contracts.
