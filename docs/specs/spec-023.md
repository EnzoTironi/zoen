# SPEC-023 — Effect execution, provider evidence and honest settlement

**Milestone:** S4 · **Owner:** Integrations and Kernel · **Root:** `packages/ontology/src/effects`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Restate orchestrates narrow durable attempts; PostgreSQL owns EffectIntent, attempts and settlement meaning. No exactly-once claim is made for an arbitrary external provider. Ambiguous unsafe operations reconcile before retry, or stop for evidence.

## Owned state and storage contract
ontology.effect_intents(effect_id PK,world_id,receipt_id,ordinal,provider,operation,intent_digest,args_ref,deadline,UNIQUE(receipt_id,ordinal)); ontology.effect_attempts(attempt_id PK,effect_id,epoch,fence,permit_ref,state,sent_at,provider_key,observation_ref); ontology.settlements(settlement_id PK,effect_id,status,provider_state,evidence_refs,observed_at,supersedes); ontology.provider_contracts(contract_id PK,provider,api_version,idempotency_scope,horizon,reconciliation_modes,certificate_ref).

## Operations

```text
AcquireEffectPermit(intent,worker,epoch) -> Permit | Denied; AttemptEffect(intent,permit) -> AttemptObservation; ReconcileEffect(effectId) -> ObservedState | Unknown; RecordSettlement(effectId,providerEvidence) -> SettlementReceipt.
```

## Execution protocol
Derive stable effect identity from receipt plus ordinal. Request a narrow lease binding destination/account/amount/deadline/epoch and current deny state. Persist attempt before network. Capture exact authorized provider evidence. Provider acceptance, delivery, business success and financial settlement are distinct. Do not auto-retry a transmitted ambiguous non-idempotent request through generic ctx.run retry behavior. A compensation is a new Action.

V4 refinement: An app has no generic provider-write path through a runner broker. Consequential provider calls consume the existing committed EffectIntent and current effect permit; a runtime success response is not settlement.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-023](../algorithms/spec-023.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0135](../tickets/zn-0135.md) | Admit Restate and narrow durable handler contract | component | [ZN-0068](../tickets/zn-0068.md), [ZN-0134](../tickets/zn-0134.md) |
| [ZN-0136](../tickets/zn-0136.md) | Issue just-in-time effect permits with current fences | component | [ZN-0135](../tickets/zn-0135.md) |
| [ZN-0137](../tickets/zn-0137.md) | Record attempt and ambiguous outcome states | component | [ZN-0136](../tickets/zn-0136.md) |
| [ZN-0138](../tickets/zn-0138.md) | Implement provider reconciliation and callback deduplication | component | [ZN-0137](../tickets/zn-0137.md) |
| [ZN-0139](../tickets/zn-0139.md) | Implement cancellation and compensation honestly | component | [ZN-0138](../tickets/zn-0138.md) |
| [ZN-0140](../tickets/zn-0140.md) | Qualify one actual external action and reconciliation profile | admission | [ZN-0139](../tickets/zn-0139.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `actions-effects-and-settlement.md`, `technology-stack.md`. Read a named historical reference only when needed; it cannot override current contracts.
