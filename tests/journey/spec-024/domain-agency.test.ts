// @zoen-plan tests/journey/spec-024/domain-agency.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/journey/spec-024/domain-agency.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/journey/spec-024/domain-agency.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-024](../../../docs/specs/spec-024.md).
// Tickets: [ZN-0145](../../../docs/tickets/zn-0145.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0145 [required layer=journey; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0145-AC:
//     ARRANGE A bakery purchase, household reminder and clinic reschedule use different domain inputs
//     ACT Their normal protocols execute
//     ASSERT All preserve shared consent/budget/settlement laws without customer-specific kernel code; the concurrent clinic slot race commits at most one booking and never leaks clinical details
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0145-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Exceed scope, root budget, deadline or action allowlist. The step remains blocked without spending or widening authority. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0145-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   AVAILABLE SPEC-LOCAL FAULT BOUNDARIES (apply only when owned by this ticket):
//     F-11: barrier=two reservation requests concurrently; inject=Real SQL race, 70+70 against100; assert=At most one 70 accepted; total ≤100.
//
//   ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
//   CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
//   NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
