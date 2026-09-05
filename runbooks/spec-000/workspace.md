# File plan — `runbooks/spec-000/workspace.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-000/workspace.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-000](../../docs/specs/spec-000.md).
Tickets: [ZN-0003](../../docs/tickets/zn-0003.md).

## Responsibility and reuse

## ZN-0003 operational/repair procedure

Scope: Create workspace, strict build and dependency boundaries. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
An Eve module tries to import the PostgreSQL adapter and the web app tries to read an authority credential
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
INPUT: ticket ID, repository commit, admitted profile, actual lock bytes, required check IDs.
READ: current execution catalog and immutable evidence; never infer completion from file existence.
VERIFY repository/data-preservation inventory before permitting destructive migration work.
RESOLVE exact dependencies on the target using real registries; record actual integrity and compatibility, not guessed lock entries.
COLLECT tests by required IDs; reject missing selection, duplicate ownership, zero executions and skipped required cases.
RUN actual component/browser/provider dependencies; unavailable dependency => BLOCKED, not a substitute.
BIND report to commit, lock, fixture seed, profile, commands and artifact digests.
REQUIRE independent review and current external gate when applicable; keep all other routes disabled.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Both forbidden dependencies fail CI; valid port imports build; no placeholder route is exposed
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-000
AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.

No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.

[algorithm SPEC-000](../../docs/algorithms/spec-000.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
