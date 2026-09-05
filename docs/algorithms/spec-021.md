# SPEC-021 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-021](../specs/spec-021.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Domain Product**. Module: `packs/clinic`. Milestone: **S3**.

## Normative operation signatures

```text
InspectAvailability(scope,timeRange) -> AuthorizedSlots; ProposeReschedule(appointment,slot,basis) -> ActionCase when S4 admitted; InspectAdministrativePatient(subject,purpose) -> RestrictedFrame.
```

## State and transaction contract

Released definitions: Clinic, Appointment, ProviderAvailability, Room, PatientAdministrativeIdentity, BillingReference and ClinicalRecordReference. Clinical payload rights do not inherit from appointment visibility. All instances use the common ontology storage and audited domain operations.

## Shared algorithm

```text
DECLARE administrative identity, availability, appointment, room and restricted clinical references as data-only pack types.
RESOLVE patient identity from guarded evidence; name alone cannot identify a patient.
REPRESENT local appointments with explicit timezone and ambiguity handling.
QUERY only authorized room/provider intervals and administrative facts; clinical counts/existence do not leak to reception.
WHEN proposing scheduling changes use interval/predicate guards and the common ActionCase path.
PREVENT concurrent double booking under authority domain fences; stale basis requires a new proposal.
KEEP clinical payload and billing permissions independent from appointment visibility.
REQUIRE actual approved clinical scope and provider evidence before affected operations can activate.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0124](../tickets/zn-0124.md) | Author clinic administrative and restricted interfaces | [packs/clinic/spec-021/clinic-definitions.json](../../packs/clinic/spec-021/clinic-definitions.json.plan.md) |
| [ZN-0125](../tickets/zn-0125.md) | Implement available-slot planning without clinical disclosure | [packs/clinic/spec-021/clinic-availability.json](../../packs/clinic/spec-021/clinic-availability.json.plan.md) |
| [ZN-0126](../tickets/zn-0126.md) | Define guarded rescheduling and reminders | [packs/clinic/spec-021/clinic-actions.json](../../packs/clinic/spec-021/clinic-actions.json.plan.md) |
| [ZN-0127](../tickets/zn-0127.md) | Prove group, revocation and ambiguous identity cases | [tests/journey/spec-021/clinic-security-journey.test.ts](../../tests/journey/spec-021/clinic-security-journey.test.ts) |
| [ZN-0128](../tickets/zn-0128.md) | Review clinical scope before real-data activation | [admissions/spec-021/clinic-scope-review.json](../../admissions/spec-021/clinic-scope-review.json.plan.md) |

## Required proof boundaries

Match patient identity through guarded resolution, not names alone. Represent appointments in explicit timezone/wall-time types. Prevent double booking with room/provider interval-domain fences. Clinical counts and existence stay hidden from reception unless policy explicitly permits a non-sensitive administrative reference.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
