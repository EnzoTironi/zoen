# File plan — `contracts/spec-007/frame-disclosure.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-007/frame-disclosure.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-007](../../docs/specs/spec-007.md).
Tickets: [ZN-0046](../../docs/tickets/zn-0046.md).

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

### SPEC-007
Inspect(operationId,input,purpose,expectedContract) -> WorldFrame; Explain(frameId,grant) -> Frame; OpenFrame(frameId,freshGrant) -> SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable; Discover(grant) -> AllowedOperationManifest.

ontology.frames(frame_id PK,world_id,head_digest,cut_json,operation_id,plan_digest,perspective,rights_basis,payload_ref,created_at,expires_at); ontology.frame_pins(frame_id,evidence_or_snapshot_ref PK,retention_class). Opaque Focus records live in Eve, not here. Index frames by World and ID; no global public digest endpoint.

[algorithm SPEC-007](../../docs/algorithms/spec-007.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
