// @zoen-plan packages/ontology/src/flows/flow-dag.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/flows/flow-dag.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/flows/flow-dag.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-032](../../../../docs/specs/spec-032.md).
// Tickets: [ZN-0186](../../../../docs/tickets/zn-0186.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0186 /* planning label, not a public API */
//   OWNER := SPEC-032; TARGET := packages/ontology/src/flows/flow-dag.ts
//   REQUIRE accepted dependencies: ZN-0094, ZN-0123, ZN-0185
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     COMPILE released flow DAG with typed steps, scopes, budgets and explicit checkpoint/watermark semantics.
//     CAPTURE real source records with stable source identity before transformation/admission.
//     CHECK lease/fence and replay checkpoint; retries deduplicate work without suppressing genuine revisions.
//     EXECUTE bounded transformations over exact input versions with recorded lineage and rights.
//     COMMIT progress/checkpoint only after durable outputs and admitted transitions; partial batch stays explicit.
//     HANDLE late/out-of-order events, schema change, tombstones and gaps according to the released source contract.
//     PUBLISH only through evidence/dataset/authority protocols; a successful job is not a published business fact.
//     STOP/rebase incompatible definitions and revoked sources; no inferred deletion from temporary absence.
//   TICKET-SPECIFIC SEGMENT:
//     01. Support source, map, filter, join, aggregate, quality and publish nodes with typed ports.
//     02. Declare resource/cycle/partition limits and source/effect permissions.
//     03. Reject arbitrary code in trusted nodes; route custom transforms to isolated artifacts.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A cyclic flow without bounded iteration and a valid revenue-reconciliation DAG
//     WHEN The compiler validates both
//     THEN The unsafe graph is rejected; the valid graph yields typed input/output and lineage contracts
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
