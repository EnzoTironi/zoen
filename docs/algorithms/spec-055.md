# SPEC-055 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-055](../specs/spec-055.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Quality and Security**. Module: `journeys/mini-apps`. Milestone: **S3**.

## Normative operation signatures

```text
AssertEquivalentSemanticResult; AssertExecutorEntry; RunNoBypassCampaign; RunThreeAudienceAppJourney; QualifyAppWorkload. These are test harness operations, not public production tools.
```

## State and transaction contract

No new authority store. Synthetic fixtures, paired visibility sets, trace digests, operation identities and signed CI evidence are test artifacts. Production data is never embedded in this package. Admission reports bind commit, lock, source rights, browser/runtime/deployment profile and expected checks.

## Shared algorithm

```text
SEED actual disposable services with authorized household/bakery/institutional facts, comparable disagreements and a denied rival.
PIN equivalent identity, purpose, release, rights and temporal basis for web/CLI/Eve/app/SDK requests.
ASSERT common executor entry and canonical semantic data/errors before rendering; prose equality is irrelevant.
REUSE exact Case and operation ID for cross-surface continuation; distinct IDs must not be falsely deduplicated.
RACE approvals with relevant predicate insertion, rights revocation and commit failure; observe actual durable receipts/effects.
ATTACK links/assets/bridge/exports/streams/runtime state with forged identities, hostile code and revoked grants on real qualified hosts.
MEASURE declared app workload rows/users/rights selectivity/bytes/query counts and actual hardware; proposed targets stay separate.
RUN runtime definition changes, scoped corrections, sharing and governed actions for all three audiences without customer forks.
REOPEN affected evidence when code/rights/model/runtime/profile changes; missing qualification blocks final acceptance.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0320](../tickets/zn-0320.md) | Prove early human-agent-declarative read and divergence equivalence | [tests/journey/spec-055/early-parity.test.ts](../../tests/journey/spec-055/early-parity.test.ts) |
| [ZN-0321](../tickets/zn-0321.md) | Prove cross-surface approval, stale consent and retry identity | [tests/chaos/spec-055/action-parity.test.ts](../../tests/chaos/spec-055/action-parity.test.ts) |
| [ZN-0322](../tickets/zn-0322.md) | Audit data route closure and executable-app confused deputy attacks | [tests/chaos/spec-055/no-bypass-campaign.test.ts](../../tests/chaos/spec-055/no-bypass-campaign.test.ts) |
| [ZN-0323](../tickets/zn-0323.md) | Measure mini-app batched reads, exports and streaming budgets | [tests/performance/spec-055/app-workload.test.ts](../../tests/performance/spec-055/app-workload.test.ts) |
| [ZN-0324](../tickets/zn-0324.md) | Prove household, professional and institutional Workshop journeys | [tests/journey/spec-055/three-audience-apps.test.ts](../../tests/journey/spec-055/three-audience-apps.test.ts) |
| [ZN-0325](../tickets/zn-0325.md) | Audit v4 execution requirements through institutional final acceptance | [admissions/spec-055/v4-final-audit.json](../../admissions/spec-055/v4-final-audit.json.plan.md) |

## Required proof boundaries

Cover read/discovery, mutation/approval/replay, sharing/revocation, streams/exports and runtime publication. Include denied, invalid, stale, changed intent, Unknown and resource limits. Do not count presentation equality as semantic parity or different operation IDs as one intention. Raw traces must not expose hidden source values.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
