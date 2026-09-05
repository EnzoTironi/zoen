# SPEC-055 — Cross-surface equivalence, adversarial app journeys and capacity

**Milestone:** S3 · **Owner:** Quality and Security · **Root:** `journeys/mini-apps`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Prove one path structurally and behaviorally. Tests compare semantic outputs at equivalent authorized context and exact basis, not prose or equal permissions for different users. Human, agent and app frontends cannot certify themselves. Fault tests must exercise actual executor, database, policies, browsers and admitted runtime where claimed.

## Owned state and storage contract
No new authority store. Synthetic fixtures, paired visibility sets, trace digests, operation identities and signed CI evidence are test artifacts. Production data is never embedded in this package. Admission reports bind commit, lock, source rights, browser/runtime/deployment profile and expected checks.

## Operations

```text
AssertEquivalentSemanticResult; AssertExecutorEntry; RunNoBypassCampaign; RunThreeAudienceAppJourney; QualifyAppWorkload. These are test harness operations, not public production tools.
```

## Execution protocol
Cover read/discovery, mutation/approval/replay, sharing/revocation, streams/exports and runtime publication. Include denied, invalid, stale, changed intent, Unknown and resource limits. Do not count presentation equality as semantic parity or different operation IDs as one intention. Raw traces must not expose hidden source values.

Exact fixtures, equivalence normalization and hostile cases are in [mini-app conformance](../testing/mini-app-conformance.md). Every required product check starts unrun. Local Python package-control tests do not execute these journeys.

## Pseudocode and file ownership

[algorithm SPEC-055](../algorithms/spec-055.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0320](../tickets/zn-0320.md) | Prove early human-agent-declarative read and divergence equivalence | journey | [ZN-0111](../tickets/zn-0111.md), [ZN-0300](../tickets/zn-0300.md), [ZN-0305](../tickets/zn-0305.md) |
| [ZN-0321](../tickets/zn-0321.md) | Prove cross-surface approval, stale consent and retry identity | chaos | [ZN-0134](../tickets/zn-0134.md), [ZN-0138](../tickets/zn-0138.md), [ZN-0306](../tickets/zn-0306.md) |
| [ZN-0322](../tickets/zn-0322.md) | Audit data route closure and executable-app confused deputy attacks | chaos | [ZN-0158](../tickets/zn-0158.md), [ZN-0292](../tickets/zn-0292.md), [ZN-0312](../tickets/zn-0312.md), [ZN-0319](../tickets/zn-0319.md) |
| [ZN-0323](../tickets/zn-0323.md) | Measure mini-app batched reads, exports and streaming budgets | performance | [ZN-0295](../tickets/zn-0295.md), [ZN-0312](../tickets/zn-0312.md) |
| [ZN-0324](../tickets/zn-0324.md) | Prove household, professional and institutional Workshop journeys | journey | [ZN-0206](../tickets/zn-0206.md), [ZN-0307](../tickets/zn-0307.md), [ZN-0313](../tickets/zn-0313.md), [ZN-0322](../tickets/zn-0322.md), [ZN-0323](../tickets/zn-0323.md) |
| [ZN-0325](../tickets/zn-0325.md) | Audit v4 execution requirements through institutional final acceptance | admission | [ZN-0283](../tickets/zn-0283.md), [ZN-0324](../tickets/zn-0324.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `testing-and-ci.md`, `apps-charts-and-surfaces.md`. Read a named historical reference only when needed; it cannot override current contracts.
