# File plan — `tests/admission/spec-000/execution-lock.test.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `tests/admission/spec-000/execution-lock.test.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-000](../../../docs/specs/spec-000.md).
Tickets: [ZN-0002](../../../docs/tickets/zn-0002.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
SUITE ZN-0002 [required layer=admission; currently NOT IMPLEMENTED]
  REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
  USE synthetic input records, not synthetic services, fake credentials or canned provider responses.

  TEST ZN-0002-AC:
    ARRANGE A clean machine and candidate core profile; all versions initially unadmitted
    ACT Two clean installs consume the candidate frozen lock
    ASSERT Both resolve identical integrity digests and pass the four compatibility probes; any missing binary or failing probe blocks core admission
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0002-NEG:
    ARRANGE the same ticket component with the stated invalid/denied input.
    ACT only through its real supported boundary; inspect denial and lack of side effects.
    ASSERT Submit an incomplete, expired or mismatched qualification artifact for this exact scope. Admission remains blocked; the missing requirement and still-disabled route are explicit.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0002-BOUNDARY:
    ARRANGE the same component at its named failure/replay/resource boundary.
    ACT with independently controlled real connection/process barriers when I/O is involved.
    ASSERT Re-run qualification selection with a changed version, provider, region or expired approval. Previous evidence cannot transfer silently; record the exact newly blocked scope.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
  CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
  NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
