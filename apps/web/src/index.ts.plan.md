# File plan — `apps/web/src/index.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `apps/web/src/index.ts`. Representation: **existing-with-sidecar**. Allocation: **conditional-support**.

Specs: [SPEC-000](../../../docs/specs/spec-000.md).
Tickets: [ZN-0003](../../../docs/tickets/zn-0003.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
COMPOSITION/REGISTRATION PLAN.
IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
BIND the existing semantic executor once; register this module's released operation descriptors.
DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
KEEP shared composition edits under the named exclusive lock.
```

## Owning state / operation contracts

### SPEC-000
AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.

No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.

[algorithm SPEC-000](../../../docs/algorithms/spec-000.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
