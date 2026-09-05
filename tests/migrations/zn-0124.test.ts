// @zoen-plan tests/migrations/zn-0124.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0124.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0124.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-021](../../docs/specs/spec-021.md).
// Tickets: [ZN-0124](../../docs/tickets/zn-0124.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-021
// InspectAvailability(scope,timeRange) -> AuthorizedSlots; ProposeReschedule(appointment,slot,basis) -> ActionCase when S4 admitted; InspectAdministrativePatient(subject,purpose) -> RestrictedFrame.
//
// Released definitions: Clinic, Appointment, ProviderAvailability, Room, PatientAdministrativeIdentity, BillingReference and ClinicalRecordReference. Clinical payload rights do not inherit from appointment visibility. All instances use the common ontology storage and audited domain operations.
//
// [algorithm SPEC-021](../../docs/algorithms/spec-021.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
