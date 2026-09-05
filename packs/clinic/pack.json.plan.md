# File plan — `packs/clinic/pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/clinic/pack.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-021](../../docs/specs/spec-021.md).
Tickets: [ZN-0124](../../docs/tickets/zn-0124.md), [ZN-0125](../../docs/tickets/zn-0125.md), [ZN-0126](../../docs/tickets/zn-0126.md).

## Responsibility and reuse

```text
DATA-ONLY PACK PLAN.
DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.
COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.
COMPILE/evaluate/publish through normal definition governance.
KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.
```

## Owning state / operation contracts

### SPEC-021
InspectAvailability(scope,timeRange) -> AuthorizedSlots; ProposeReschedule(appointment,slot,basis) -> ActionCase when S4 admitted; InspectAdministrativePatient(subject,purpose) -> RestrictedFrame.

Released definitions: Clinic, Appointment, ProviderAvailability, Room, PatientAdministrativeIdentity, BillingReference and ClinicalRecordReference. Clinical payload rights do not inherit from appointment visibility. All instances use the common ontology storage and audited domain operations.

[algorithm SPEC-021](../../docs/algorithms/spec-021.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
