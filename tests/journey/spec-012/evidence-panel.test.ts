// @zoen-plan tests/journey/spec-012/evidence-panel.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/journey/spec-012/evidence-panel.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/journey/spec-012/evidence-panel.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-012](../../../docs/specs/spec-012.md).
// Tickets: [ZN-0072](../../../docs/tickets/zn-0072.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0072 [required layer=journey; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0072-AC:
//     ARRANGE Two sources disagree and the user does not know which is correct
//     ACT They choose I do not know then inspect evidence
//     ASSERT The dispute stays unresolved, no claim selection occurs and the same authorized basis is visible
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0072-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Open the flow on a shared device after logout or without access. No previous person’s context appears; accessible denial remains usable. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0072-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT Repeat with duplicate/reordered input, revoked access and the profile limit at the task boundary. Preserve the declared oracle; report unsupported/incomplete state rather than silent truncation, disclosure or fabricated success.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
//   CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
//   NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
