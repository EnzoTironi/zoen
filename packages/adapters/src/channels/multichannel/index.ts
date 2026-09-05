// @zoen-plan packages/adapters/src/channels/multichannel/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/channels/multichannel/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/channels/multichannel/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-028](../../../../../docs/specs/spec-028.md).
// Tickets: [ZN-0164](../../../../../docs/tickets/zn-0164.md), [ZN-0165](../../../../../docs/tickets/zn-0165.md), [ZN-0166](../../../../../docs/tickets/zn-0166.md), [ZN-0167](../../../../../docs/tickets/zn-0167.md).
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
// ### SPEC-028
// AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.
//
// Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.
//
// [algorithm SPEC-028](../../../../../docs/algorithms/spec-028.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
