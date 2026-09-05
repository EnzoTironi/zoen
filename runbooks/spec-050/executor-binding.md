# File plan — `runbooks/spec-050/executor-binding.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-050/executor-binding.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-050](../../docs/specs/spec-050.md).
Tickets: [ZN-0291](../../docs/tickets/zn-0291.md).

## Responsibility and reuse

## ZN-0291 operational/repair procedure

Scope: Bind every structured ingress to the existing semantic dispatcher. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Web and CLI issue the same Inspect under equal verified context and pinned basis
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
NORMALIZE transport input into the common envelope; obtain identity and app/workload context only from verified server bindings.
RESOLVE allowed operation using the existing SPEC-007 dispatcher; do not instantiate another executor.
PRESERVE intent ID, contract digest, basis and purpose on retry/resumption; a new ID is a new intention.
INTERSECT current user/delegation rights, admitted app capabilities and current source restrictions centrally.
FOR batches/streams/exports support bounded work and exact basis; reauthorize each item/chunk/resumption.
CACHE only with full subject/World/delegation/app/purpose/release/query/cut/security key; references are not permits.
COMPARE canonical semantic outcomes under equivalent authority/basis, not natural-language presentation.
AUDIT every ingress/asset/export/worker path for bypasses; structured app calls require neither Eve nor an LLM.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Both enter SPEC-007 dispatch.ts and return the same authorized interpretation, rival references, basis and result tag; no model invocation occurs
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-050
SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.

No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.

[algorithm SPEC-050](../../docs/algorithms/spec-050.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
