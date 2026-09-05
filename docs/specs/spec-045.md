# SPEC-045 — Finance security master, corporate actions and licensed information

**Milestone:** S11 · **Owner:** Finance Domain · **Root:** `packs/finance/reference-data`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Finance is a governed domain pack, not an implicit license or regulated-service authorization. Instrument, listing, issuer, account and beneficial owner are distinct. Restated fundamentals, raw/adjusted series and revised corporate actions preserve point-in-time provenance.

## Owned state and storage contract
Released objects: Instrument, Listing, Issuer, IdentifierAssignment, Account, BeneficialOwner, CorporateAction, Filing, FundamentalObservation and NewsItem. Values use common claims/datasets with source/license/knowledge cuts. Identifier namespace and valid dates are explicit; licensed raw content may be reference-only.

## Operations

```text
ResolveInstrument(sourceAlias,cut) -> InstrumentFrame | Ambiguous; InspectCorporateAction(id,cut) -> RevisionedAction; QueryFundamentals(metric,asOf,knowledgeCut) -> LicensedFrame; QueryNews(subject,cut,use) -> PermittedEvidence.
```

## Execution protocol
Never key all finance entities by ticker. Corporate actions bind announcement/ex/record/pay dates, elections, affected quantities and revision chain. Point-in-time reads exclude later filings/restatements/mappings unless requested and labeled. Source entitlements constrain display, redistribution, analytics, storage and model use independently.

## Pseudocode and file ownership

[algorithm SPEC-045](../algorithms/spec-045.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0261](../tickets/zn-0261.md) | Define instrument, listing, issuer and identifier master | component | [ZN-0218](../tickets/zn-0218.md), [ZN-0244](../tickets/zn-0244.md), [ZN-0254](../tickets/zn-0254.md) |
| [ZN-0262](../tickets/zn-0262.md) | Model corporate-action lifecycle and revisions | component | [ZN-0261](../tickets/zn-0261.md) |
| [ZN-0263](../tickets/zn-0263.md) | Ingest as-reported and restated fundamentals | component | [ZN-0262](../tickets/zn-0262.md) |
| [ZN-0264](../tickets/zn-0264.md) | Ingest licensed news and revisioned research evidence | component | [ZN-0263](../tickets/zn-0263.md) |
| [ZN-0265](../tickets/zn-0265.md) | Prove finance reference-data reconciliation | journey | [ZN-0264](../tickets/zn-0264.md) |
| [ZN-0266](../tickets/zn-0266.md) | Admit licensed reference-data and research scopes | admission | [ZN-0265](../tickets/zn-0265.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `finance-domain.md`, `identity-and-time.md`. Read a named historical reference only when needed; it cannot override current contracts.
