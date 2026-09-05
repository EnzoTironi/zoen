# SPEC-012 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-012](../specs/spec-012.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Experience**. Module: `apps/web/src/experience`. Milestone: **S1**.

## Normative operation signatures

```text
ConversationRoute(focus?) -> AccessibleConversation; SourceSetup(intent,availableSources) -> ProgressiveSetup; EvidencePanel(frameRef) -> AuthorizedView; StopControl(turnOrMandateRef) -> ExplicitState.
```

## State and transaction contract

No domain database. UI stores only presentation preferences and opaque Focus in Eve-owned APIs. Browser caches are keyed by principal, World, purpose, release and security revision, and are cleared on identity/audience changes.

## Shared algorithm

```text
VERIFY presence; let a person create a private World or accept a specific invitation without conflating operations.
ASK for one useful authorized source or expose an honest empty World; never require all integrations before value.
USE the shared semantic client for uploads, questions, inspection and scoped answers.
RENDER missing, disputed and provisional facts distinctly with visible source/as-of explanation.
OFFER keyboard/screen-reader navigation, focus management and text alternatives; test real browsers and zoom.
ESCALATE uncertainty with a scoped question rather than requiring the user to understand schemas.
KEEP link/session identity outside content; channel changes reopen context under fresh rights.
GATE usability claims on observed journeys; no mock identity or demo data disguised as connected truth.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0070](../tickets/zn-0070.md) | Implement honest empty and partial onboarding states | [tests/journey/spec-012/onboarding.test.ts](../../tests/journey/spec-012/onboarding.test.ts) |
| [ZN-0071](../tickets/zn-0071.md) | Implement keyboard and large-text accessible interaction | [tests/journey/spec-012/accessibility.test.ts](../../tests/journey/spec-012/accessibility.test.ts) |
| [ZN-0072](../tickets/zn-0072.md) | Implement evidence deepening and scoped clarification | [tests/journey/spec-012/evidence-panel.test.ts](../../tests/journey/spec-012/evidence-panel.test.ts) |
| [ZN-0073](../tickets/zn-0073.md) | Implement shared-device logout and context separation | [tests/journey/spec-012/shared-device.test.ts](../../tests/journey/spec-012/shared-device.test.ts) |
| [ZN-0074](../tickets/zn-0074.md) | Run moderated first-use acceptance across the three audiences | [admissions/spec-012/usability-evidence.json](../../admissions/spec-012/usability-evidence.json.plan.md) |

## Required proof boundaries

Use React Aria primitives and semantic HTML. Start in pt-BR with internationalized messages and explicit locale for numbers/dates. Provide large text, keyboard operation, focus restoration and text alternatives. Do not reveal old content on a shared device before current authentication. Questions offer unknown/undo; consent is distinct from friendly conversational agreement.

V4 refinement: The accessible trusted host is reused by mini apps. Secure login/logout, inspection, evidence and confirmations are not reimplemented per app.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
