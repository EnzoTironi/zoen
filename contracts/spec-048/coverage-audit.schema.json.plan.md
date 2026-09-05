# File plan — `contracts/spec-048/coverage-audit.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-048/coverage-audit.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-048](../../docs/specs/spec-048.md).
Tickets: [ZN-0285](../../docs/tickets/zn-0285.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-048
EvaluateReleaseCandidate(commit,profile) -> AcceptanceReport; CheckCapabilityCoverage(requirements,evidence) -> Covered|Missing; PromoteOperatingProfile(report,approvals) -> Admitted|Blocked.

No new product authority store. evidence/release-candidates/<commit> contains immutable reports, dependency locks, requirement/test coverage, threat findings, workload certificates, user-study evidence, provider qualifications, unresolved deviations and sign-off records. The current capability support matrix is derived from accepted evidence, not manually edited success flags.

[algorithm SPEC-048](../../docs/algorithms/spec-048.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
