// @zoen-plan tooling/supply-chain.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tooling/supply-chain.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tooling/supply-chain.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-000](../docs/specs/spec-000.md).
// Tickets: [ZN-0006](../docs/tickets/zn-0006.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0006 /* planning label, not a public API */
//   OWNER := SPEC-000; TARGET := tooling/supply-chain.ts
//   REQUIRE accepted dependencies: ZN-0005
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     INPUT: ticket ID, repository commit, admitted profile, actual lock bytes, required check IDs.
//     READ: current execution catalog and immutable evidence; never infer completion from file existence.
//     VERIFY repository/data-preservation inventory before permitting destructive migration work.
//     RESOLVE exact dependencies on the target using real registries; record actual integrity and compatibility, not guessed lock entries.
//     COLLECT tests by required IDs; reject missing selection, duplicate ownership, zero executions and skipped required cases.
//     RUN actual component/browser/provider dependencies; unavailable dependency => BLOCKED, not a substitute.
//     BIND report to commit, lock, fixture seed, profile, commands and artifact digests.
//     REQUIRE independent review and current external gate when applicable; keep all other routes disabled.
//   TICKET-SPECIFIC SEGMENT:
//     01. Generate an SBOM and build provenance from the admitted lock.
//     02. Pin CI actions and OCI bases by immutable identity; sign releasable images with an admitted signing identity.
//     03. Add secret scanning, license policy and mandatory architecture/security reviewer rules.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A dependency changed without a lock update or an unsigned image is offered for promotion
//     WHEN CI builds and evaluates release eligibility
//     THEN Promotion is denied; the evidence identifies the exact mismatch without printing credentials
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
