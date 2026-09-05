// @zoen-plan packages/ontology/src/definitions/ontology-grammar.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/definitions/ontology-grammar.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/definitions/ontology-grammar.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-013](../../../../docs/specs/spec-013.md).
// Tickets: [ZN-0075](../../../../docs/tickets/zn-0075.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0075 /* planning label, not a public API */
//   OWNER := SPEC-013; TARGET := packages/ontology/src/definitions/ontology-grammar.ts
//   REQUIRE accepted dependencies: ZN-0012, ZN-0024, ZN-0046
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     INPUT: immutable definition graph, supported kernel/operator versions and expected base release.
//     VALIDATE stable semantic IDs, reference closure, field schemas, bounded resource budgets and operator allowlist.
//     REJECT cycles where prohibited, unbounded recursion, remote executable references and unknown operators.
//     TYPECHECK queries, rules, actions, Watches, views and policy requirements against one symbol table.
//     COMPILE to a closed deterministic IR; attach exact dependency/schema/component digests and declared journey requirements.
//     DERIVE cross-surface operation descriptors from that same IR, not hand-maintained transport definitions.
//     CANONICALIZE and hash bytes; release is immutable, active state lives only in the World control head.
//     RETURN deterministic diagnostics without installing definitions or granting requested powers.
//   TICKET-SPECIFIC SEGMENT:
//     01. Write closed JSON Schema 2020-12 variants for semantic definitions.
//     02. Include scalar dimensions, evidence requirements, cardinality and stable IDs.
//     03. Support imported vocabulary annotations without granting execution or rights.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A property label rename and a change from booked revenue to received cash
//     WHEN The grammar and compatibility checks run
//     THEN The rename may preserve its ID; the semantic basis change requires an explicit new meaning/migration and cannot be passed as cosmetic
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
