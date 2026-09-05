// @zoen-plan packages/ontology/src/packs/pack-overlays.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/packs/pack-overlays.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/packs/pack-overlays.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-037](../../../../docs/specs/spec-037.md).
// Tickets: [ZN-0214](../../../../docs/tickets/zn-0214.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0214 /* planning label, not a public API */
//   OWNER := SPEC-037; TARGET := packages/ontology/src/packs/pack-overlays.ts
//   REQUIRE accepted dependencies: ZN-0213
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VERIFY publisher artifact identities, dependency closure and local policy before installation.
//     SEPARATE reusable definitions from per-World source credentials, private instances and overlays.
//     COMPUTE semantic/permission/retention diff for upgrades; conflicts are explicit, not last-writer wins.
//     PREPARE migration and classify affected Cases/Watches/Mandates/apps/sessions under common release machinery.
//     APPROVE under current local rights; marketplace reputation cannot grant new powers.
//     ACTIVATE exact immutable binding, never external latest; compatible rename differs from meaning compatibility.
//     ON uninstall/recall stop new use and handle pins, historical explanation, open work and private caches explicitly.
//     REPORT unsupported distribution/license/provider scope rather than treating package presence as production qualification.
//   TICKET-SPECIFIC SEGMENT:
//     01. Keep upstream definitions immutable and local specialization in explicit overlay artifacts.
//     02. Detect incompatible semantic-ID reuse and namespace collisions.
//     03. Include overlay dependencies in compiler/evaluation/upgrade digests.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A business specializes a standard revenue metric for local accounting
//     WHEN The overlay compiles
//     THEN The local meaning is explicit and versioned; upstream semantics are not silently changed for other customers
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
