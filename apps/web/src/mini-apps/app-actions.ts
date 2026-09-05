// @zoen-plan apps/web/src/mini-apps/app-actions.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/web/src/mini-apps/app-actions.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/web/src/mini-apps/app-actions.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-052](../../../../docs/specs/spec-052.md).
// Tickets: [ZN-0306](../../../../docs/tickets/zn-0306.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0306 /* planning label, not a public API */
//   OWNER := SPEC-052; TARGET := apps/web/src/mini-apps/app-actions.ts
//   REQUIRE accepted dependencies: ZN-0133, ZN-0138, ZN-0299, ZN-0305
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
//     01. Map form submission to existing propose/answer/commit operations using the shared semantic client.
//     02. Render consequence, expiry, basis and approval in trusted host chrome fetched from the server.
//     03. Carry operation identity across chat-to-app handoff; retain Unknown external results and re-propose stale consent explicitly.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A user begins one action in chat and opens the same Case in an app
//     WHEN The form confirms it with the same identity while a retry arrives from chat
//     THEN At most one decision receipt/effect intent is committed; the host displays the authoritative consequence and settlement remains separately observed
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
