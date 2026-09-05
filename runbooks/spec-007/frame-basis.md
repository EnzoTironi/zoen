# File plan — `runbooks/spec-007/frame-basis.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-007/frame-basis.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-007](../../docs/specs/spec-007.md).
Tickets: [ZN-0042](../../docs/tickets/zn-0042.md).

## Responsibility and reuse

## ZN-0042 operational/repair procedure

Scope: Implement bounded Frame basis acquisition. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The actual Frame builder runs
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
INPUT enters through one dispatcher using a verified server context; never accept client-supplied principal/grant as proof.
VALIDATE envelope, released operation ID, compatible contract, bounded arguments and purpose.
RESOLVE exactly one released handler; transports do not implement business policy or reconciliation.
FOR reads: open coherent head/rights/domain cut in REPEATABLE READ; constrain authorized set before ranking/aggregation.
PIN exact immutable evidence/dataset refs; materialize bounded sparse inputs, then close long-running SQL snapshots.
COMPUTE the operation result at the pinned basis; preserve gaps, uncertainty, source lineage and interpretation status.
FOR mutations call AuthorityCommit/ActionCase; for streams/exports use the same registered operations and current disclosure checks.
REAUTHORIZE before payload/chunk delivery; changed rights => denied or safely rebuilt result, never stale authorization reuse.
RETURN one tagged semantic result; text, UI and transport framing happen outside this executor.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Head, sparse rows and admitted references come from one coherent snapshot, never a mixed pre/post state
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-007
Inspect(operationId,input,purpose,expectedContract) -> WorldFrame; Explain(frameId,grant) -> Frame; OpenFrame(frameId,freshGrant) -> SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable; Discover(grant) -> AllowedOperationManifest.

ontology.frames(frame_id PK,world_id,head_digest,cut_json,operation_id,plan_digest,perspective,rights_basis,payload_ref,created_at,expires_at); ontology.frame_pins(frame_id,evidence_or_snapshot_ref PK,retention_class). Opaque Focus records live in Eve, not here. Index frames by World and ID; no global public digest endpoint.

[algorithm SPEC-007](../../docs/algorithms/spec-007.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
