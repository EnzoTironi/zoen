# File plan — `runbooks/spec-012/onboarding.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-012/onboarding.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-012](../../docs/specs/spec-012.md).
Tickets: [ZN-0070](../../docs/tickets/zn-0070.md).

## Responsibility and reuse

## ZN-0070 operational/repair procedure

Scope: Implement honest empty and partial onboarding states. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The onboarding flow runs
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY presence; let a person create a private World or accept a specific invitation without conflating operations.
ASK for one useful authorized source or expose an honest empty World; never require all integrations before value.
USE the shared semantic client for uploads, questions, inspection and scoped answers.
RENDER missing, disputed and provisional facts distinctly with visible source/as-of explanation.
OFFER keyboard/screen-reader navigation, focus management and text alternatives; test real browsers and zoom.
ESCALATE uncertainty with a scoped question rather than requiring the user to understand schemas.
KEEP link/session identity outside content; channel changes reopen context under fresh rights.
GATE usability claims on observed journeys; no mock identity or demo data disguised as connected truth.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It says the evidence is missing and offers a relevant source/input; it does not invent a financial summary or demand all integrations
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-012
ConversationRoute(focus?) -> AccessibleConversation; SourceSetup(intent,availableSources) -> ProgressiveSetup; EvidencePanel(frameRef) -> AuthorizedView; StopControl(turnOrMandateRef) -> ExplicitState.

No domain database. UI stores only presentation preferences and opaque Focus in Eve-owned APIs. Browser caches are keyed by principal, World, purpose, release and security revision, and are cleared on identity/audience changes.

[algorithm SPEC-012](../../docs/algorithms/spec-012.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
