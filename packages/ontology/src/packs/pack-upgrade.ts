// @zoen-plan packages/ontology/src/packs/pack-upgrade.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/packs/pack-upgrade.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/packs/pack-upgrade.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-037](../../../../docs/specs/spec-037.md).
// Tickets: [ZN-0215](../../../../docs/tickets/zn-0215.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0215 /* planning label, not a public API */
//   OWNER := SPEC-037; TARGET := packages/ontology/src/packs/pack-upgrade.ts
//   REQUIRE accepted dependencies: ZN-0214
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
//     01. Compute semantic diff and local-overlay conflicts before upgrade.
//     02. Prepare migrations and Case/Watch/model/app dispositions.
//     03. Removal leaves retained evidence/history interpretable or explicitly unavailable under policy.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An upstream pack removes a property used by a local app and an open ActionCase
//     WHEN Upgrade/removal is requested
//     THEN The operation is blocked pending disposition and cannot silently break the app or reuse stale approval
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
