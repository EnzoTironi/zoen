// @zoen-plan packages/eve/src/turns/tool-dispatch.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/eve/src/turns/tool-dispatch.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/eve/src/turns/tool-dispatch.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-009](../../../../docs/specs/spec-009.md).
// Tickets: [ZN-0054](../../../../docs/tickets/zn-0054.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0054 /* planning label, not a public API */
//   OWNER := SPEC-009; TARGET := packages/eve/src/turns/tool-dispatch.ts
//   REQUIRE accepted dependencies: ZN-0053
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     ADMIT a durable ingress identity once; create turn and conversation-owned state without World credentials.
//     CLAIM a fenced lease and CAS state/version before each transition.
//     PERSIST model-call intent before network; record actual outcome/usage before scheduling tool work.
//     REOPEN grounding via the shared semantic client; preserve tool operation ID through retries and recovery.
//     STREAM provisional text explicitly; interrupted attempts are not silently spliced into a false exact continuation.
//     PERSIST settled visible message before handing it to channel delivery; deduplicate by turn/revision.
//     ON crash reconstruct from settled journal facts and pending intents; zombie fence cannot settle messages.
//     ON cancel or revoked rights stop future steps; retain known/unknown external attempts for reconciliation.
//   TICKET-SPECIFIC SEGMENT:
//     01. Build tools from the allowed manifest and pin contract digests.
//     02. Persist tool intent and stable operation ID before invocation.
//     03. Resume from recorded semantic result or retry with the same intent, never direct adapter access.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A tool succeeds but Eve crashes before recording its result
//     WHEN The turn resumes and repeats the tool call
//     THEN Ontology returns the same authorized result; no duplicate mutation or effect is created
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
