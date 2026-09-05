// @zoen-plan packages/ontology/src/surfaces/frame-basis.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/surfaces/frame-basis.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/surfaces/frame-basis.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-007](../../../../docs/specs/spec-007.md).
// Tickets: [ZN-0042](../../../../docs/tickets/zn-0042.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0042 /* planning label, not a public API */
//   OWNER := SPEC-007; TARGET := packages/ontology/src/surfaces/frame-basis.ts
//   REQUIRE accepted dependencies: ZN-0036
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
//     01. Read head, relevant domain versions, rights and admitted evidence in one repeatable-read snapshot.
//     02. Capture a plan digest and required immutable input pins.
//     03. Do not hold the transaction across LLM or unbounded analytics work.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An ingestion commits between two would-be Frame reads
//     WHEN The actual Frame builder runs
//     THEN Head, sparse rows and admitted references come from one coherent snapshot, never a mixed pre/post state
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
