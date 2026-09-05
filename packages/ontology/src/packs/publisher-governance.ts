// @zoen-plan packages/ontology/src/packs/publisher-governance.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/packs/publisher-governance.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/packs/publisher-governance.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-037](../../../../docs/specs/spec-037.md).
// Tickets: [ZN-0216](../../../../docs/tickets/zn-0216.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0216 /* planning label, not a public API */
//   OWNER := SPEC-037; TARGET := packages/ontology/src/packs/publisher-governance.ts
//   REQUIRE accepted dependencies: ZN-0215
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
//     01. Track signing key rotation/recall and installation provenance.
//     02. Notify only authorized administrators of affected installs.
//     03. Deny publisher access to customer data absent a separate explicit source/data-use grant.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A publisher revokes a compromised signing key
//     WHEN Registry policy reevaluates installs
//     THEN Affected execution is restricted under recall policy while historical provenance remains; customer data is never disclosed to the publisher automatically
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
