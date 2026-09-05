# File plan — `packs/finance/reference-data/spec-045/pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/reference-data/spec-045/pack.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-045](../../../../docs/specs/spec-045.md).
Tickets: [ZN-0261](../../../../docs/tickets/zn-0261.md), [ZN-0262](../../../../docs/tickets/zn-0262.md), [ZN-0263](../../../../docs/tickets/zn-0263.md), [ZN-0264](../../../../docs/tickets/zn-0264.md).

## Responsibility and reuse

```text
DATA-ONLY PACK PLAN.
DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.
COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.
COMPILE/evaluate/publish through normal definition governance.
KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.
```

## Owning state / operation contracts

### SPEC-045
ResolveInstrument(sourceAlias,cut) -> InstrumentFrame | Ambiguous; InspectCorporateAction(id,cut) -> RevisionedAction; QueryFundamentals(metric,asOf,knowledgeCut) -> LicensedFrame; QueryNews(subject,cut,use) -> PermittedEvidence.

Released objects: Instrument, Listing, Issuer, IdentifierAssignment, Account, BeneficialOwner, CorporateAction, Filing, FundamentalObservation and NewsItem. Values use common claims/datasets with source/license/knowledge cuts. Identifier namespace and valid dates are explicit; licensed raw content may be reference-only.

[algorithm SPEC-045](../../../../docs/algorithms/spec-045.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
