# File plan — `runbooks/spec-023/effect-reconcile.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-023/effect-reconcile.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-023](../../docs/specs/spec-023.md).
Tickets: [ZN-0138](../../docs/tickets/zn-0138.md).

## Responsibility and reuse

## ZN-0138 operational/repair procedure

Scope: Implement provider reconciliation and callback deduplication. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Settlement admission processes them
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
DERIVE effect identity from DecisionReceipt plus ordinal; bind actual provider contract/idempotency horizon.
ACQUIRE a current narrow dispatch permit binding account/destination/body/deadline/epoch/fence and deny state.
PERSIST attempt before network; do not hold authority transaction across the provider call.
SEND with stable provider idempotency identity when supported; capture actual response or ambiguous transmission evidence.
IF transmission may have occurred and provider cannot deduplicate/reconcile safely: Unknown; do not blind-retry.
RECONCILE through actual provider status/evidence and record separate Settlement with provenance.
DEDUPLICATE callbacks and validate provider account/signature; acceptance, delivery and business settlement are different states.
COMPENSATION is a new authorized ActionCase; cancellation cannot claim to undo an already accepted request.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Duplicates do not duplicate state; the contradiction is preserved and flagged rather than overwritten
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-023
AcquireEffectPermit(intent,worker,epoch) -> Permit | Denied; AttemptEffect(intent,permit) -> AttemptObservation; ReconcileEffect(effectId) -> ObservedState | Unknown; RecordSettlement(effectId,providerEvidence) -> SettlementReceipt.

ontology.effect_intents(effect_id PK,world_id,receipt_id,ordinal,provider,operation,intent_digest,args_ref,deadline,UNIQUE(receipt_id,ordinal)); ontology.effect_attempts(attempt_id PK,effect_id,epoch,fence,permit_ref,state,sent_at,provider_key,observation_ref); ontology.settlements(settlement_id PK,effect_id,status,provider_state,evidence_refs,observed_at,supersedes); ontology.provider_contracts(contract_id PK,provider,api_version,idempotency_scope,horizon,reconciliation_modes,certificate_ref).

[algorithm SPEC-023](../../docs/algorithms/spec-023.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
