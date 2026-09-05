// @zoen-plan packages/ontology/src/apps/app-lifecycle.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/apps/app-lifecycle.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/apps/app-lifecycle.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-052](../../../../docs/specs/spec-052.md).
// Tickets: [ZN-0307](../../../../docs/tickets/zn-0307.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0307 /* planning label, not a public API */
//   OWNER := SPEC-052; TARGET := packages/ontology/src/apps/app-lifecycle.ts
//   REQUIRE accepted dependencies: ZN-0172, ZN-0215, ZN-0306
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VALIDATE immutable app definition against approved component versions, typed bindings, resource limits and accessibility labels.
//     REJECT arbitrary script/HTML/eval/provider URLs/SQL and hidden data bindings in declarative mode.
//     RESOLVE query/action bindings to stable released semantic operations; presentation cannot manufacture authoritative metrics.
//     INSTANTIATE template parameters as ordinary allowed instance change only when semantics/powers stay unchanged.
//     FOR changed definitions use existing compile/evaluate/prepare/approve/activate path; create, publish and share are separate.
//     OPEN app through protected session and reuse the common semantic client for all data, subscriptions and exports.
//     RENDER read-only defaults, conflicts and missing values faithfully; consequential forms use trusted ActionCase confirmation.
//     UPGRADE/uninstall/recall through versioned release/artifact lifecycle; no mutable runtime latest alias as authority.
//   TICKET-SPECIFIC SEGMENT:
//     01. Classify link/session/form behavior for upgrade, retirement, recall and historical rendering.
//     02. Reuse pack release and artifact revocation; clear owned private caches and block new calls when recalled.
//     03. Retain audit receipts without resurrecting erased data or older unsafe executable code.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An app has active links, forms and a pinned old release
//     WHEN The publisher recalls the executable artifact or the owner uninstalls the app
//     THEN New sessions are blocked and active sessions stop protected calls; historical evidence uses a safe admitted renderer or explicit unavailability
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
