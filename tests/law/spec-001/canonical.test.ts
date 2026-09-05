// @zoen-plan tests/law/spec-001/canonical.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/law/spec-001/canonical.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/law/spec-001/canonical.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-001](../../../docs/specs/spec-001.md).
// Tickets: [ZN-0010](../../../docs/tickets/zn-0010.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0010 [required layer=law; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0010-AC:
//     ARRANGE Equivalent objects with different key insertion order and malformed duplicate-key JSON
//     ACT They are parsed and canonicalized
//     ASSERT Equivalent values produce the same digest; malformed input is rejected and cannot be silently last-write-wins
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0010-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Supply an invalid type, incompatible unit/time/realm or unsupported scalar to this task’s pure boundary. It returns the specified tagged error without coercion or I/O.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0010-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT Exercise empty/minimum/maximum/overflow and reordered equivalent inputs using recorded seeds. Exact semantics are deterministic; unsupported limits yield explicit errors, not truncation.
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
