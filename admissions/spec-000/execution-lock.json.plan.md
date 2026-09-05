# File plan — `admissions/spec-000/execution-lock.json`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `admissions/spec-000/execution-lock.json`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-000](../../docs/specs/spec-000.md).
Tickets: [ZN-0002](../../docs/tickets/zn-0002.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0002 /* planning label, not a public API */
  OWNER := SPEC-000; TARGET := admissions/spec-000/execution-lock.json
  REQUIRE accepted dependencies: ZN-0001
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    INPUT: ticket ID, repository commit, admitted profile, actual lock bytes, required check IDs.
    READ: current execution catalog and immutable evidence; never infer completion from file existence.
    VERIFY repository/data-preservation inventory before permitting destructive migration work.
    RESOLVE exact dependencies on the target using real registries; record actual integrity and compatibility, not guessed lock entries.
    COLLECT tests by required IDs; reject missing selection, duplicate ownership, zero executions and skipped required cases.
    RUN actual component/browser/provider dependencies; unavailable dependency => BLOCKED, not a substitute.
    BIND report to commit, lock, fixture seed, profile, commands and artifact digests.
    REQUIRE independent review and current external gate when applicable; keep all other routes disabled.
  TICKET-SPECIFIC SEGMENT:
    01. Resolve exact patches within v2 selected families from primary registries.
    02. Install a clean disposable workspace and run Hono streaming, pg transaction, Cedar deny and schema/canonicalizer probes.
    03. Record integrity, platform, licenses and vulnerability findings; reject incompatible candidates without substituting a new family.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A clean machine and candidate core profile; all versions initially unadmitted
    WHEN Two clean installs consume the candidate frozen lock
    THEN Both resolve identical integrity digests and pass the four compatibility probes; any missing binary or failing probe blocks core admission
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
