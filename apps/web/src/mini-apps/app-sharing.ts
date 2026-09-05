// @zoen-plan apps/web/src/mini-apps/app-sharing.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/web/src/mini-apps/app-sharing.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/web/src/mini-apps/app-sharing.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-051](../../../../docs/specs/spec-051.md).
// Tickets: [ZN-0300](../../../../docs/tickets/zn-0300.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0300 /* planning label, not a public API */
//   OWNER := SPEC-051; TARGET := apps/web/src/mini-apps/app-sharing.ts
//   REQUIRE accepted dependencies: ZN-0107, ZN-0299
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
//     01. Add governed share UI using existing invitation/delegation operations separately from CreateContinuation.
//     02. Bind optional recipient restriction and permitted audience context; no app-owned ACL grants.
//     03. Explain reauthentication and missing access without disclosing hidden target metadata.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A bakery owner creates a production-only view for a worker
//     WHEN The worker forwards the same link to an external person
//     THEN The worker sees only permitted production fields; the external person receives no access unless a separate invitation/grant is approved and accepted
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
