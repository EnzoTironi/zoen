# File plan — `runbooks/spec-015/oauth-binding.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-015/oauth-binding.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-015](../../docs/specs/spec-015.md).
Tickets: [ZN-0090](../../docs/tickets/zn-0090.md).

## Responsibility and reuse

## ZN-0090 operational/repair procedure

Scope: Implement brokered OAuth and secret references. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The sync worker requests a lease
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
REGISTER provider recipe and instance separately; record credential references only.
VALIDATE scopes, source namespaces, allowed destinations, query templates, incremental strategy and license/ACL behavior.
PERFORM real OAuth binding through supported provider flow; validate state/PKCE/redirect contract in admitted adapter.
STORE secret material only in broker-owned secret storage; runtime definition sees an opaque binding reference.
ACQUIRE bounded source pages with watermark and request identity; source missing page is not deletion.
CHECK current source rights/freshness; stage raw capture before mapping/admission through existing evidence machinery.
COMMIT checkpoints only after durable capture/admission position; deduplicate replay without dropping genuine revision changes.
QUALIFY each actual source account/profile; missing permission or credentials keeps that binding disabled, not emulated.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The agent never sees the token; a revoked token prevents fresh reads and source health becomes auth-required
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-015
ConfigureSource(definition,instance,operationId) -> Binding; SyncSource(binding,cursor) -> CapturedBatch; AdmitBatch(binding,batch,expectedCursor) -> BatchReceipt; InventoryCoverage(world,scope) -> CoverageFrame.

ontology.source_inventory(source_id PK,world_id,owner,category,coverage_scope,expected_freshness,admission_state); ontology.source_bindings(binding_id PK,world_id,definition_digest,credential_ref,state,acl_policy_ref); jobs.source_cursors(binding_id,partition_id PK,cursor_json,watermark,lease_fence,schema_digest); ontology.source_health(binding_id,observed_at PK,status,gaps_json); ontology.source_tombstones(binding_id,external_id,revision PK,evidence_ref).

[algorithm SPEC-015](../../docs/algorithms/spec-015.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
