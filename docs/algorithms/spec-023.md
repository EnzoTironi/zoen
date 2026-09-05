# SPEC-023 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-023](../specs/spec-023.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Integrations and Kernel**. Module: `packages/ontology/src/effects`. Milestone: **S4**.

## Normative operation signatures

```text
AcquireEffectPermit(intent,worker,epoch) -> Permit | Denied; AttemptEffect(intent,permit) -> AttemptObservation; ReconcileEffect(effectId) -> ObservedState | Unknown; RecordSettlement(effectId,providerEvidence) -> SettlementReceipt.
```

## State and transaction contract

ontology.effect_intents(effect_id PK,world_id,receipt_id,ordinal,provider,operation,intent_digest,args_ref,deadline,UNIQUE(receipt_id,ordinal)); ontology.effect_attempts(attempt_id PK,effect_id,epoch,fence,permit_ref,state,sent_at,provider_key,observation_ref); ontology.settlements(settlement_id PK,effect_id,status,provider_state,evidence_refs,observed_at,supersedes); ontology.provider_contracts(contract_id PK,provider,api_version,idempotency_scope,horizon,reconciliation_modes,certificate_ref).

## Shared algorithm

```text
DERIVE effect identity from DecisionReceipt plus ordinal; bind actual provider contract/idempotency horizon.
ACQUIRE a current narrow dispatch permit binding account/destination/body/deadline/epoch/fence and deny state.
PERSIST attempt before network; do not hold authority transaction across the provider call.
SEND with stable provider idempotency identity when supported; capture actual response or ambiguous transmission evidence.
IF transmission may have occurred and provider cannot deduplicate/reconcile safely: Unknown; do not blind-retry.
RECONCILE through actual provider status/evidence and record separate Settlement with provenance.
DEDUPLICATE callbacks and validate provider account/signature; acceptance, delivery and business settlement are different states.
COMPENSATION is a new authorized ActionCase; cancellation cannot claim to undo an already accepted request.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0135](../tickets/zn-0135.md) | Admit Restate and narrow durable handler contract | [packages/ontology/src/effects/restate-adapter.ts](../../packages/ontology/src/effects/restate-adapter.ts) |
| [ZN-0136](../tickets/zn-0136.md) | Issue just-in-time effect permits with current fences | [packages/ontology/src/effects/effect-permits.ts](../../packages/ontology/src/effects/effect-permits.ts) |
| [ZN-0137](../tickets/zn-0137.md) | Record attempt and ambiguous outcome states | [packages/ontology/src/effects/effect-attempt.ts](../../packages/ontology/src/effects/effect-attempt.ts) |
| [ZN-0138](../tickets/zn-0138.md) | Implement provider reconciliation and callback deduplication | [packages/ontology/src/effects/effect-reconcile.ts](../../packages/ontology/src/effects/effect-reconcile.ts) |
| [ZN-0139](../tickets/zn-0139.md) | Implement cancellation and compensation honestly | [packages/ontology/src/effects/effect-cancel.ts](../../packages/ontology/src/effects/effect-cancel.ts) |
| [ZN-0140](../tickets/zn-0140.md) | Qualify one actual external action and reconciliation profile | [admissions/spec-023/provider-effect-qualification.json](../../admissions/spec-023/provider-effect-qualification.json.plan.md) |

## Required proof boundaries

Derive stable effect identity from receipt plus ordinal. Request a narrow lease binding destination/account/amount/deadline/epoch and current deny state. Persist attempt before network. Capture exact authorized provider evidence. Provider acceptance, delivery, business success and financial settlement are distinct. Do not auto-retry a transmitted ambiguous non-idempotent request through generic ctx.run retry behavior. A compensation is a new Action.

V4 refinement: An app has no generic provider-write path through a runner broker. Consequential provider calls consume the existing committed EffectIntent and current effect permit; a runtime success response is not settlement.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
