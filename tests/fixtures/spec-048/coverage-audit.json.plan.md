# File plan — `tests/fixtures/spec-048/coverage-audit.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-048/coverage-audit.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-048](../../../docs/specs/spec-048.md).
Tickets: [ZN-0285](../../../docs/tickets/zn-0285.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-048
EvaluateReleaseCandidate(commit,profile) -> AcceptanceReport; CheckCapabilityCoverage(requirements,evidence) -> Covered|Missing; PromoteOperatingProfile(report,approvals) -> Admitted|Blocked.

No new product authority store. evidence/release-candidates/<commit> contains immutable reports, dependency locks, requirement/test coverage, threat findings, workload certificates, user-study evidence, provider qualifications, unresolved deviations and sign-off records. The current capability support matrix is derived from accepted evidence, not manually edited success flags.

[algorithm SPEC-048](../../../docs/algorithms/spec-048.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
