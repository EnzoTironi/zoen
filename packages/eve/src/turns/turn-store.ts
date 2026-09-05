// @zoen-plan packages/eve/src/turns/turn-store.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/eve/src/turns/turn-store.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/eve/src/turns/turn-store.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-009](../../../../docs/specs/spec-009.md).
// Tickets: [ZN-0052](../../../../docs/tickets/zn-0052.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0052 /* planning label, not a public API */
//   OWNER := SPEC-009; TARGET := packages/eve/src/turns/turn-store.ts
//   REQUIRE accepted dependencies: ZN-0041, ZN-0046, ZN-0051
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
//     01. Implement the normative turn states and transition table.
//     02. Accept ingress with a unique key and conversation ordering token.
//     03. Keep Ontology receipts as references, not copied authority records.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN One ingress delivered twice to a conversation with an existing pending turn
//     WHEN AcceptTurn races across two workers
//     THEN Exactly one new turn is created and the documented conversation order is preserved
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
