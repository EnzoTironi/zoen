# File plan — `tests/fixtures/spec-045/security-master.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-045/security-master.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-045](../../../docs/specs/spec-045.md).
Tickets: [ZN-0261](../../../docs/tickets/zn-0261.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-045
ResolveInstrument(sourceAlias,cut) -> InstrumentFrame | Ambiguous; InspectCorporateAction(id,cut) -> RevisionedAction; QueryFundamentals(metric,asOf,knowledgeCut) -> LicensedFrame; QueryNews(subject,cut,use) -> PermittedEvidence.

Released objects: Instrument, Listing, Issuer, IdentifierAssignment, Account, BeneficialOwner, CorporateAction, Filing, FundamentalObservation and NewsItem. Values use common claims/datasets with source/license/knowledge cuts. Identifier namespace and valid dates are explicit; licensed raw content may be reference-only.

[algorithm SPEC-045](../../../docs/algorithms/spec-045.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
