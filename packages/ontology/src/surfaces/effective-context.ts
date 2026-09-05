// @zoen-plan packages/ontology/src/surfaces/effective-context.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/surfaces/effective-context.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/surfaces/effective-context.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-050](../../../../docs/specs/spec-050.md).
// Tickets: [ZN-0293](../../../../docs/tickets/zn-0293.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0293 /* planning label, not a public API */
//   OWNER := SPEC-050; TARGET := packages/ontology/src/surfaces/effective-context.ts
//   REQUIRE accepted dependencies: ZN-0086, ZN-0291
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     NORMALIZE transport input into the common envelope; obtain identity and app/workload context only from verified server bindings.
//     RESOLVE allowed operation using the existing SPEC-007 dispatcher; do not instantiate another executor.
//     PRESERVE intent ID, contract digest, basis and purpose on retry/resumption; a new ID is a new intention.
//     INTERSECT current user/delegation rights, admitted app capabilities and current source restrictions centrally.
//     FOR batches/streams/exports support bounded work and exact basis; reauthorize each item/chunk/resumption.
//     CACHE only with full subject/World/delegation/app/purpose/release/query/cut/security key; references are not permits.
//     COMPARE canonical semantic outcomes under equivalent authority/basis, not natural-language presentation.
//     AUDIT every ingress/asset/export/worker path for bypasses; structured app calls require neither Eve nor an LLM.
//   TICKET-SPECIFIC SEGMENT:
//     01. Intersect subject/delegation rights, installed app ceiling, session scope and current source rights in the shared grant admission.
//     02. Store no grant in URLs or UI state; reject forged app, World, purpose, operation and recipient substitutions.
//     03. Attach subject, actor, application, installation and purpose to audit attribution without changing the core idempotency key.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A private owner opens an app whose admitted ceiling excludes the money field
//     WHEN The app requests production data and then tries a money operation available to the owner outside this app
//     THEN Production is returned and money is denied under the same owner authorizer plus app ceiling; app capabilities cannot expand rights. S3 separately proves worker sharing
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
