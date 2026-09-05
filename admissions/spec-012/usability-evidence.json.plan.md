# File plan — `admissions/spec-012/usability-evidence.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-012/usability-evidence.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-012](../../docs/specs/spec-012.md).
Tickets: [ZN-0074](../../docs/tickets/zn-0074.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0074 /* planning label, not a public API */
  OWNER := SPEC-012; TARGET := admissions/spec-012/usability-evidence.json
  REQUIRE accepted dependencies: ZN-0073
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    VERIFY presence; let a person create a private World or accept a specific invitation without conflating operations.
    ASK for one useful authorized source or expose an honest empty World; never require all integrations before value.
    USE the shared semantic client for uploads, questions, inspection and scoped answers.
    RENDER missing, disputed and provisional facts distinctly with visible source/as-of explanation.
    OFFER keyboard/screen-reader navigation, focus management and text alternatives; test real browsers and zoom.
    ESCALATE uncertainty with a scoped question rather than requiring the user to understand schemas.
    KEEP link/session identity outside content; channel changes reopen context under fresh rights.
    GATE usability claims on observed journeys; no mock identity or demo data disguised as connected truth.
  TICKET-SPECIFIC SEGMENT:
    01. Prepare tasks for an older consumer, independent professional and enterprise steward.
    02. Measure completion, misunderstanding, mistaken consent and recovery from wrong answers.
    03. Require owner-reviewed evidence and revise interaction specs rather than declaring success from screenshots.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN The product passes automated UI tests but has no observed target-user sessions
    WHEN Consumer-ready activation is requested
    THEN The usability gate remains open until the planned sessions and findings are recorded; automation alone is not claimed as accessibility/usability proof
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
