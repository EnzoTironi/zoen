// @zoen-plan tests/component/spec-007/discovery.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/component/spec-007/discovery.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/component/spec-007/discovery.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-007](../../../docs/specs/spec-007.md).
// Tickets: [ZN-0044](../../../docs/tickets/zn-0044.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0044 [required layer=component; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0044-AC:
//     ARRANGE A receptionist and a clinician discover the same World
//     ACT Each requests available fields and explanations
//     ASSERT Only permitted capabilities appear; hidden clinical fields do not leak in schemas, counts, examples or error detail
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0044-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Read an opaque ref without current permission. No data, row count, existence metadata or evidence URL leaks. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0044-BOUNDARY:
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
