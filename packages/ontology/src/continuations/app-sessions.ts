// @zoen-plan packages/ontology/src/continuations/app-sessions.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/continuations/app-sessions.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/continuations/app-sessions.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-051](../../../../docs/specs/spec-051.md).
// Tickets: [ZN-0299](../../../../docs/tickets/zn-0299.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0299 /* planning label, not a public API */
//   OWNER := SPEC-051; TARGET := packages/ontology/src/continuations/app-sessions.ts
//   REQUIRE accepted dependencies: ZN-0293, ZN-0297, ZN-0304
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     CREATE a random opaque link reference for permitted Focus/app target, recipient constraint, version policy and optional expiry.
//     STORE no access token in URL; creation, publication, invitation and sharing remain distinct operations.
//     GET/HEAD/previews return generic side-effect-free content without data, challenge consumption or target existence leaks.
//     ON explicit POST exchange validate CSRF/origin and browser-bound challenge, then verify Door identity/assurance.
//     RESOLVE target through current World membership, recipient constraint, app publication/recall and source rights.
//     ISSUE server-side scoped session bound to principal/actor/World/realm/purpose/exact publication/security revision/expiry.
//     ON every later semantic call recheck session and current rights; stable link never preserves old grants.
//     REVOKE link and session independently; historical rendering cannot revive recalled code or erased content.
//   TICKET-SPECIFIC SEGMENT:
//     01. Bind a session to verified actor/subject, World/realm, current published manifest/artifact, purpose and admitted app ceiling.
//     02. Keep only an opaque host-side session handle; never disclose a World token to a guest.
//     03. Recheck active publication/recall/security state on every semantic call, refresh and resume.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A private app is published and the same owner opens two purpose-scoped sessions
//     WHEN The owner opens the stable link and one purpose-scoped session expires or is revoked
//     THEN Each permitted session is independently scoped; expired/revoked sessions cannot call any data operation or regain authority through a refresh token
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
