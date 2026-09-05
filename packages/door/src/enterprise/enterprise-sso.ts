// @zoen-plan packages/door/src/enterprise/enterprise-sso.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/door/src/enterprise/enterprise-sso.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/door/src/enterprise/enterprise-sso.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-038](../../../../docs/specs/spec-038.md).
// Tickets: [ZN-0219](../../../../docs/tickets/zn-0219.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0219 /* planning label, not a public API */
//   OWNER := SPEC-038; TARGET := packages/door/src/enterprise/enterprise-sso.ts
//   REQUIRE accepted dependencies: ZN-0111, ZN-0117, ZN-0158
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VERIFY issuer/audience/signature/time through admitted identity library and current metadata rotation contract.
//     MAP stable issuer/subject identifiers; do not merge accounts solely by email.
//     PROCESS SCIM create/update/deactivate idempotently with provider revision and local guards.
//     APPLY group-to-role mapping only within released organization policy; directory data cannot expand platform trust.
//     ON deactivation revoke current access, browser/workload bindings and streams at documented boundaries.
//     REACTIVATION is a fresh governed mapping, not replay of old privileges.
//     MINT distinct workload identity with narrow scope, rotation/expiry and attributable delegation chain.
//     QUALIFY actual IdP/SCIM tenant and failure modes; no development administrator or fake SSO bypass.
//   TICKET-SPECIFIC SEGMENT:
//     01. Implement supported Better Auth enterprise adapter profile with issuer/audience and metadata checks.
//     02. Test key rotation, wrong tenant, expired assertion and account linking.
//     03. Reject email-only automatic identity merges.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Two enterprise issuers present the same email for different stable subjects
//     WHEN They authenticate
//     THEN They remain separate principals unless an explicit verified linking operation occurs
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
