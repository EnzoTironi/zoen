// @zoen-plan runners/runner-profile.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `runners/runner-profile.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `runners/runner-profile.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-030](../docs/specs/spec-030.md).
// Tickets: [ZN-0174](../docs/tickets/zn-0174.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0174 /* planning label, not a public API */
//   OWNER := SPEC-030; TARGET := runners/runner-profile.ts
//   REQUIRE accepted dependencies: ZN-0111, ZN-0139, ZN-0173
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     ACQUIRE lease bound to World/realm/principal/purpose/artifact/input cut/budget/epoch and admitted host profile.
//     START outside authority process in actual qualified containment with default-deny network and no ambient credentials.
//     DENY host files, container socket, metadata endpoints and authority/source secrets; enforce limits outside guest process.
//     FOR an app request expose only released semantic calls through the common executor; no generic URL/SQL/provider proxy.
//     FOR separately admitted acquisition/effect lanes validate capability, destination, DNS/redirect chain, body and lease on every use.
//     SUPPLY immutable read inputs for analysis, record nondeterminism/seed/environment and output lineage.
//     VALIDATE bounded outputs and current rights before admission; publishing is a separate governed operation.
//     ON expiry/revocation/resource violation stop fenced execution, retain real unknown effects and cleanup only unpinned artifacts.
//   TICKET-SPECIFIC SEGMENT:
//     01. Provision separate runtime/OS/network identity without authority credentials.
//     02. Configure gVisor or the reviewed microVM mechanism with deny-by-default egress and metadata blocking.
//     03. Record tested kernel/runtime versions and explicit unsupported features.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A guest attempts host filesystem, Docker socket and metadata service access
//     WHEN The real isolated runner executes the attack fixture
//     THEN Every attempt fails at the host/network boundary, not only via a cooperative guest library
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
