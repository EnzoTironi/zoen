// @zoen-plan tests/migrations/zn-0165.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0165.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0165.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-028](../../docs/specs/spec-028.md).
// Tickets: [ZN-0165](../../docs/tickets/zn-0165.md).
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
// ### SPEC-028
// AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.
//
// Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.
//
// [algorithm SPEC-028](../../docs/algorithms/spec-028.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
