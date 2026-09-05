# SPEC-000 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-000](../specs/spec-000.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform**. Module: `tooling`. Milestone: **S0**.

## Normative operation signatures

```text
AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.
```

## State and transaction contract

No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.

## Shared algorithm

```text
INPUT: ticket ID, repository commit, admitted profile, actual lock bytes, required check IDs.
READ: current execution catalog and immutable evidence; never infer completion from file existence.
VERIFY repository/data-preservation inventory before permitting destructive migration work.
RESOLVE exact dependencies on the target using real registries; record actual integrity and compatibility, not guessed lock entries.
COLLECT tests by required IDs; reject missing selection, duplicate ownership, zero executions and skipped required cases.
RUN actual component/browser/provider dependencies; unavailable dependency => BLOCKED, not a substitute.
BIND report to commit, lock, fixture seed, profile, commands and artifact digests.
REQUIRE independent review and current external gate when applicable; keep all other routes disabled.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0001](../tickets/zn-0001.md) | Record repository and data-preservation baseline | [admissions/spec-000/baseline-inventory.json](../../admissions/spec-000/baseline-inventory.json.plan.md) |
| [ZN-0002](../tickets/zn-0002.md) | Admit the exact core toolchain | [admissions/spec-000/execution-lock.json](../../admissions/spec-000/execution-lock.json.plan.md) |
| [ZN-0003](../tickets/zn-0003.md) | Create workspace, strict build and dependency boundaries | [tooling/workspace.ts](../../tooling/workspace.ts.plan.md) |
| [ZN-0004](../tickets/zn-0004.md) | Create real dependency test harness with explicit clocks and barriers | [tooling/test-harness.ts](../../tooling/test-harness.ts.plan.md) |
| [ZN-0005](../tickets/zn-0005.md) | Enforce evidence-bound pull-request completion | [tooling/verify-ticket.ts](../../tooling/verify-ticket.ts) |
| [ZN-0006](../tickets/zn-0006.md) | Protect secrets, artifacts and merge policy | [tooling/supply-chain.ts](../../tooling/supply-chain.ts) |

## Required proof boundaries

Freeze repository commit identities before reuse. Admit a core lock first and extension locks just before their milestone. The lock must include Node, pnpm, TypeScript, Hono, pg, PostgreSQL, Cedar binding, schema validator, canonicalizer, test tools and image digests. One workspace; ontology submodules are directories, not dozens of independent services. Missing tests are failures, never successful empty runs.

V4 refinement: V4 is the execution source of truth. Preserve the input-v3 archive and stable IDs; compile a no-bypass import/credential graph for app, agent and human clients.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
