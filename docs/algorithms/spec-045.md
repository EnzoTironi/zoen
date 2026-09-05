# SPEC-045 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-045](../specs/spec-045.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Finance Domain**. Module: `packs/finance/reference-data`. Milestone: **S11**.

## Normative operation signatures

```text
ResolveInstrument(sourceAlias,cut) -> InstrumentFrame | Ambiguous; InspectCorporateAction(id,cut) -> RevisionedAction; QueryFundamentals(metric,asOf,knowledgeCut) -> LicensedFrame; QueryNews(subject,cut,use) -> PermittedEvidence.
```

## State and transaction contract

Released objects: Instrument, Listing, Issuer, IdentifierAssignment, Account, BeneficialOwner, CorporateAction, Filing, FundamentalObservation and NewsItem. Values use common claims/datasets with source/license/knowledge cuts. Identifier namespace and valid dates are explicit; licensed raw content may be reference-only.

## Shared algorithm

```text
DEFINE instruments, listings, issuers and identifier assignments with namespace and validity; ticker is not a universal key.
ADMIT licensed source observations as claims/datasets with explicit display/redistribution/model-use rights.
RESOLVE instrument candidates at requested identity and knowledge cuts; ambiguity remains visible.
MODEL corporate-action announcement/ex/record/pay dates, elections, quantities and revision lineage independently.
QUERY fundamentals/news at explicit as-of and known-at cuts; later restatements cannot leak into earlier history.
APPLY identity/corporate-action corrections through scoped governed changes with dependent recomputation.
RETURN licensed evidence references rather than unauthorized copied source content.
QUALIFY actual data licenses/providers before enabling access; architecture supplies no commercial entitlement.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0261](../tickets/zn-0261.md) | Define instrument, listing, issuer and identifier master | [packs/finance/reference-data/spec-045/security-master.json](../../packs/finance/reference-data/spec-045/security-master.json.plan.md) |
| [ZN-0262](../tickets/zn-0262.md) | Model corporate-action lifecycle and revisions | [packs/finance/reference-data/spec-045/corporate-actions.json](../../packs/finance/reference-data/spec-045/corporate-actions.json.plan.md) |
| [ZN-0263](../tickets/zn-0263.md) | Ingest as-reported and restated fundamentals | [packs/finance/reference-data/spec-045/fundamentals.json](../../packs/finance/reference-data/spec-045/fundamentals.json.plan.md) |
| [ZN-0264](../tickets/zn-0264.md) | Ingest licensed news and revisioned research evidence | [packs/finance/reference-data/spec-045/financial-news.json](../../packs/finance/reference-data/spec-045/financial-news.json.plan.md) |
| [ZN-0265](../tickets/zn-0265.md) | Prove finance reference-data reconciliation | [tests/journey/spec-045/finance-data-journey.test.ts](../../tests/journey/spec-045/finance-data-journey.test.ts) |
| [ZN-0266](../tickets/zn-0266.md) | Admit licensed reference-data and research scopes | [admissions/spec-045/finance-data-license.json](../../admissions/spec-045/finance-data-license.json.plan.md) |

## Required proof boundaries

Never key all finance entities by ticker. Corporate actions bind announcement/ex/record/pay dates, elections, affected quantities and revision chain. Point-in-time reads exclude later filings/restatements/mappings unless requested and labeled. Source entitlements constrain display, redistribution, analytics, storage and model use independently.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
