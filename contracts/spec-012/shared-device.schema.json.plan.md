# File plan — `contracts/spec-012/shared-device.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-012/shared-device.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-012](../../docs/specs/spec-012.md).
Tickets: [ZN-0073](../../docs/tickets/zn-0073.md).

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

### SPEC-012
ConversationRoute(focus?) -> AccessibleConversation; SourceSetup(intent,availableSources) -> ProgressiveSetup; EvidencePanel(frameRef) -> AuthorizedView; StopControl(turnOrMandateRef) -> ExplicitState.

No domain database. UI stores only presentation preferences and opaque Focus in Eve-owned APIs. Browser caches are keyed by principal, World, purpose, release and security revision, and are cleared on identity/audience changes.

[algorithm SPEC-012](../../docs/algorithms/spec-012.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
