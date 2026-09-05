// @zoen-plan packages/ontology/src/surfaces/frame-disclosure.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/surfaces/frame-disclosure.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/surfaces/frame-disclosure.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-007](../../../../docs/specs/spec-007.md).
// Tickets: [ZN-0046](../../../../docs/tickets/zn-0046.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0046 /* planning label, not a public API */
//   OWNER := SPEC-007; TARGET := packages/ontology/src/surfaces/frame-disclosure.ts
//   REQUIRE accepted dependencies: ZN-0045
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     INPUT enters through one dispatcher using a verified server context; never accept client-supplied principal/grant as proof.
//     VALIDATE envelope, released operation ID, compatible contract, bounded arguments and purpose.
//     RESOLVE exactly one released handler; transports do not implement business policy or reconciliation.
//     FOR reads: open coherent head/rights/domain cut in REPEATABLE READ; constrain authorized set before ranking/aggregation.
//     PIN exact immutable evidence/dataset refs; materialize bounded sparse inputs, then close long-running SQL snapshots.
//     COMPUTE the operation result at the pinned basis; preserve gaps, uncertainty, source lineage and interpretation status.
//     FOR mutations call AuthorityCommit/ActionCase; for streams/exports use the same registered operations and current disclosure checks.
//     REAUTHORIZE before payload/chunk delivery; changed rights => denied or safely rebuilt result, never stale authorization reuse.
//     RETURN one tagged semantic result; text, UI and transport framing happen outside this executor.
//   TICKET-SPECIFIC SEGMENT:
//     01. Recheck the latest local rights state immediately before result delivery.
//     02. Open historical frames under fresh rights and current retention/license policy.
//     03. Return a visibly newer or unavailable result only through its explicit union variant.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An old retained Frame, a newly revoked membership and an erased evidence artifact
//     WHEN Each is reopened under the appropriate current principal
//     THEN Revoked access yields no payload; erased content is unavailable; an authorized unchanged case reopens the pinned basis without silently refreshing it
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
