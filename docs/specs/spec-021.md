# SPEC-021 — Dental operations pack with clinical separation

**Milestone:** S3 · **Owner:** Domain Product · **Root:** `packs/clinic`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
The clinic pack provides appointments, room/provider availability, administrative commitments and billing references. Clinical notes are a separately restricted domain; no diagnosis, treatment recommendation or prescribing is silently included in an operational assistant.

## Owned state and storage contract
Released definitions: Clinic, Appointment, ProviderAvailability, Room, PatientAdministrativeIdentity, BillingReference and ClinicalRecordReference. Clinical payload rights do not inherit from appointment visibility. All instances use the common ontology storage and audited domain operations.

## Operations

```text
InspectAvailability(scope,timeRange) -> AuthorizedSlots; ProposeReschedule(appointment,slot,basis) -> ActionCase when S4 admitted; InspectAdministrativePatient(subject,purpose) -> RestrictedFrame.
```

## Execution protocol
Match patient identity through guarded resolution, not names alone. Represent appointments in explicit timezone/wall-time types. Prevent double booking with room/provider interval-domain fences. Clinical counts and existence stay hidden from reception unless policy explicitly permits a non-sensitive administrative reference.

## Pseudocode and file ownership

[algorithm SPEC-021](../algorithms/spec-021.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0124](../tickets/zn-0124.md) | Author clinic administrative and restricted interfaces | component | [ZN-0100](../tickets/zn-0100.md), [ZN-0111](../tickets/zn-0111.md), [ZN-0117](../tickets/zn-0117.md), [ZN-0123](../tickets/zn-0123.md) |
| [ZN-0125](../tickets/zn-0125.md) | Implement available-slot planning without clinical disclosure | component | [ZN-0124](../tickets/zn-0124.md) |
| [ZN-0126](../tickets/zn-0126.md) | Define guarded rescheduling and reminders | component | [ZN-0125](../tickets/zn-0125.md) |
| [ZN-0127](../tickets/zn-0127.md) | Prove group, revocation and ambiguous identity cases | journey | [ZN-0126](../tickets/zn-0126.md) |
| [ZN-0128](../tickets/zn-0128.md) | Review clinical scope before real-data activation | admission | [ZN-0127](../tickets/zn-0127.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `domain-packs-and-marketplace.md`, `rights-and-access-control.md`. Read a named historical reference only when needed; it cannot override current contracts.
