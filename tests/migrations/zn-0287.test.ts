// @zoen-plan tests/migrations/zn-0287.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0287.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0287.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-049](../../docs/specs/spec-049.md).
// Tickets: [ZN-0287](../../docs/tickets/zn-0287.md).
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
// ### SPEC-049
// ProvisionPilot(lock,region,profile) -> StagedPilot; EnableCapability(capability,codeEvidence,providerEvidence,approval) -> Admission | Blocked; RollbackPilot(image,compatibleSchema) -> SafeDeployment.
//
// Infrastructure defines private PostgreSQL, encrypted evidence, separate edge/Eve/authority roles, hosted web, secret references, monitoring and backups under an admitted regional profile. control.capability_admissions(capability_id,profile PK,code_commit,qualification_refs,state) lists enabled versus disabled routes. No customer data in control records.
//
// [algorithm SPEC-049](../../docs/algorithms/spec-049.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
