# File plan — `runbooks/spec-021/clinic-availability.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-021/clinic-availability.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-021](../../docs/specs/spec-021.md).
Tickets: [ZN-0125](../../docs/tickets/zn-0125.md).

## Responsibility and reuse

## ZN-0125 operational/repair procedure

Scope: Implement available-slot planning without clinical disclosure. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The user asks for available slots
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
DECLARE administrative identity, availability, appointment, room and restricted clinical references as data-only pack types.
RESOLVE patient identity from guarded evidence; name alone cannot identify a patient.
REPRESENT local appointments with explicit timezone and ambiguity handling.
QUERY only authorized room/provider intervals and administrative facts; clinical counts/existence do not leak to reception.
WHEN proposing scheduling changes use interval/predicate guards and the common ActionCase path.
PREVENT concurrent double booking under authority domain fences; stale basis requires a new proposal.
KEEP clinical payload and billing permissions independent from appointment visibility.
REQUIRE actual approved clinical scope and provider evidence before affected operations can activate.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The answer distinguishes known availability from unknown coverage and does not promise an unverified slot
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-021
InspectAvailability(scope,timeRange) -> AuthorizedSlots; ProposeReschedule(appointment,slot,basis) -> ActionCase when S4 admitted; InspectAdministrativePatient(subject,purpose) -> RestrictedFrame.

Released definitions: Clinic, Appointment, ProviderAvailability, Room, PatientAdministrativeIdentity, BillingReference and ClinicalRecordReference. Clinical payload rights do not inherit from appointment visibility. All instances use the common ontology storage and audited domain operations.

[algorithm SPEC-021](../../docs/algorithms/spec-021.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
