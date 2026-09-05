# File plan — `tests/law/spec-001/outcomes.test.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `tests/law/spec-001/outcomes.test.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-001](../../../docs/specs/spec-001.md).
Tickets: [ZN-0011](../../../docs/tickets/zn-0011.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
SUITE ZN-0011 [required layer=law; currently NOT IMPLEMENTED]
  REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
  USE synthetic input records, not synthetic services, fake credentials or canned provider responses.

  TEST ZN-0011-AC:
    ARRANGE A selected but contested unverified interpretation plus a literal zero amount
    ACT The result crosses JSON and TypeScript boundaries
    ASSERT All axes survive unchanged and zero never becomes unknown; unknown discriminants fail explicitly
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0011-NEG:
    ARRANGE the same ticket component with the stated invalid/denied input.
    ACT only through its real supported boundary; inspect denial and lack of side effects.
    ASSERT Supply an invalid type, incompatible unit/time/realm or unsupported scalar to this task’s pure boundary. It returns the specified tagged error without coercion or I/O.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0011-BOUNDARY:
    ARRANGE the same component at its named failure/replay/resource boundary.
    ACT with independently controlled real connection/process barriers when I/O is involved.
    ASSERT Exercise empty/minimum/maximum/overflow and reordered equivalent inputs using recorded seeds. Exact semantics are deterministic; unsupported limits yield explicit errors, not truncation.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
  CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
  NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
