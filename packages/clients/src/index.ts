// @zoen-plan packages/clients/src/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/clients/src/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/clients/src/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-000](../../../docs/specs/spec-000.md), [SPEC-026](../../../docs/specs/spec-026.md), [SPEC-050](../../../docs/specs/spec-050.md).
// Tickets: [ZN-0003](../../../docs/tickets/zn-0003.md), [ZN-0153](../../../docs/tickets/zn-0153.md), [ZN-0154](../../../docs/tickets/zn-0154.md), [ZN-0155](../../../docs/tickets/zn-0155.md), [ZN-0156](../../../docs/tickets/zn-0156.md), [ZN-0157](../../../docs/tickets/zn-0157.md), [ZN-0291](../../../docs/tickets/zn-0291.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-000
// AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.
//
// No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.
//
// [algorithm SPEC-000](../../../docs/algorithms/spec-000.md)
//
// ### SPEC-026
// Discover(world,purpose) -> AuthorizedManifest; Invoke(operationId,contractDigest,input,operationId?) -> Result; GenerateClient(manifest,target) -> ReproducibleClient; NegotiateProtocol(clientVersions) -> SelectedVersion | UnsupportedVersion.
//
// No new authority tables. Generated contracts live in contracts/generated/<release-digest> and include operation IDs, input/output/error schemas, effect class, assurance, compatibility and manifest digest. Protocol edition and generated toolchain versions are separately admitted in execution-lock.json.
//
// [algorithm SPEC-026](../../../docs/algorithms/spec-026.md)
//
// ### SPEC-050
// SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.
//
// No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.
//
// [algorithm SPEC-050](../../../docs/algorithms/spec-050.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
