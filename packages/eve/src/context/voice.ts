// @zoen-plan packages/eve/src/context/voice.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/eve/src/context/voice.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/eve/src/context/voice.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-010](../../../../docs/specs/spec-010.md).
// Tickets: [ZN-0062](../../../../docs/tickets/zn-0062.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0062 /* planning label, not a public API */
//   OWNER := SPEC-010; TARGET := packages/eve/src/context/voice.ts
//   REQUIRE accepted dependencies: ZN-0061
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     LOAD only settled visible conversation events and authority-free Focus.
//     REOPEN every referenced Frame under current rights/purpose; missing context remains an explicit gap.
//     SEGREGATE retrieved source text as untrusted data, not executable instructions or tool policy.
//     INTERSECT released skill, current grant, app/workload scope and budget to determine tools.
//     SELECT only an admitted model/data-use/residency route with sufficient budget; otherwise NoPermittedModel.
//     COMPOSE bounded context with evidence references and provisional summaries; exclude hidden reasoning fields.
//     CAPTURE real provider outputs and usage; validate structured calls and send them to the same semantic executor.
//     TREAT audio transcription as an attributed candidate statement; consequential consent uses the normal confirmation path.
//   TICKET-SPECIFIC SEGMENT:
//     01. Admit bounded audio through the evidence quarantine path.
//     02. Run the admitted transcriber outside authority and store transcript model/language/confidence metadata without treating it as truth.
//     03. Let the user correct transcript or switch to text before an approval.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Audio ambiguously says fifteen or fifty units
//     WHEN A transcript is used to propose an order change
//     THEN The uncertainty is preserved; no order change commits solely from the transcript and correction keeps original audio provenance
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
