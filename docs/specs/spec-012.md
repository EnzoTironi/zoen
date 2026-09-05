# SPEC-012 — Progressive onboarding and accessible conversation inspection

**Milestone:** S1 · **Owner:** Experience · **Root:** `apps/web/src/experience`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Onboarding starts from a useful intent and one optional source, not an integration project. A person can inspect evidence, correct an answer and stop the assistant without learning the ontology vocabulary. Accessibility is a shipped behavior, not a later theme.

## Owned state and storage contract
No domain database. UI stores only presentation preferences and opaque Focus in Eve-owned APIs. Browser caches are keyed by principal, World, purpose, release and security revision, and are cleared on identity/audience changes.

## Operations

```text
ConversationRoute(focus?) -> AccessibleConversation; SourceSetup(intent,availableSources) -> ProgressiveSetup; EvidencePanel(frameRef) -> AuthorizedView; StopControl(turnOrMandateRef) -> ExplicitState.
```

## Execution protocol
Use React Aria primitives and semantic HTML. Start in pt-BR with internationalized messages and explicit locale for numbers/dates. Provide large text, keyboard operation, focus restoration and text alternatives. Do not reveal old content on a shared device before current authentication. Questions offer unknown/undo; consent is distinct from friendly conversational agreement.

V4 refinement: The accessible trusted host is reused by mini apps. Secure login/logout, inspection, evidence and confirmations are not reimplemented per app.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-012](../algorithms/spec-012.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0070](../tickets/zn-0070.md) | Implement honest empty and partial onboarding states | journey | [ZN-0046](../tickets/zn-0046.md), [ZN-0057](../tickets/zn-0057.md), [ZN-0062](../tickets/zn-0062.md), [ZN-0068](../tickets/zn-0068.md) |
| [ZN-0071](../tickets/zn-0071.md) | Implement keyboard and large-text accessible interaction | journey | [ZN-0070](../tickets/zn-0070.md) |
| [ZN-0072](../tickets/zn-0072.md) | Implement evidence deepening and scoped clarification | journey | [ZN-0071](../tickets/zn-0071.md) |
| [ZN-0073](../tickets/zn-0073.md) | Implement shared-device logout and context separation | journey | [ZN-0072](../tickets/zn-0072.md) |
| [ZN-0074](../tickets/zn-0074.md) | Run moderated first-use acceptance across the three audiences | admission | [ZN-0073](../tickets/zn-0073.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `apps-charts-and-surfaces.md`, `release-policy-eve.md`. Read a named historical reference only when needed; it cannot override current contracts.
