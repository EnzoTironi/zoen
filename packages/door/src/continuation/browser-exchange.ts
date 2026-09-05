// @zoen-plan packages/door/src/continuation/browser-exchange.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/door/src/continuation/browser-exchange.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/door/src/continuation/browser-exchange.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-051](../../../../docs/specs/spec-051.md).
// Tickets: [ZN-0297](../../../../docs/tickets/zn-0297.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0297 /* planning label, not a public API */
//   OWNER := SPEC-051; TARGET := packages/door/src/continuation/browser-exchange.ts
//   REQUIRE accepted dependencies: ZN-0013, ZN-0296
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
//     01. Reuse Door login/passkey/SSO profiles and bind a single-use challenge to an HttpOnly host-only browser session and target digest.
//     02. Require POST with CSRF and exact Origin checks for exchange; rotate session after authentication and validate recipient.
//     03. Scrub tokens from history, referrers, telemetry and redirects; allow only local registered return targets.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A recipient-specific reference is opened in two unrelated browsers
//     WHEN The wrong browser posts a copied challenge while the intended browser authenticates
//     THEN Only the correctly bound authenticated recipient can exchange; possession of the reference alone is insufficient
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
