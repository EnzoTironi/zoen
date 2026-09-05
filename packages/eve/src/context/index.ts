// @zoen-plan packages/eve/src/context/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/eve/src/context/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/eve/src/context/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-010](../../../../docs/specs/spec-010.md).
// Tickets: [ZN-0058](../../../../docs/tickets/zn-0058.md), [ZN-0059](../../../../docs/tickets/zn-0059.md), [ZN-0060](../../../../docs/tickets/zn-0060.md), [ZN-0061](../../../../docs/tickets/zn-0061.md), [ZN-0062](../../../../docs/tickets/zn-0062.md).
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
// ### SPEC-010
// CompileContext(turn,grant,limits) -> ContextBundle | IncompleteBasis; SelectModel(requestPurpose,dataUse,region,budget) -> PermittedRoute | NoPermittedModel; ProposeTranscript(audioEvidence,languageHint) -> AttributedTranscript.
//
// eve.context_snapshots(context_id PK,turn_id,release_digest,visible_message_refs,frame_refs,skill_ref,model_route_ref,purpose,budget_ref); eve.summaries(summary_id PK,conversation_id,through_message_id,text,model_ref,expires_at); eve.model_observations(attempt_id PK,provider,model,usage,output_ref,retention_ref). Raw hidden reasoning fields are excluded by schema.
//
// [algorithm SPEC-010](../../../../docs/algorithms/spec-010.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
