// @zoen-plan packages/adapters/src/channels/multichannel/channel-continuity.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/channels/multichannel/channel-continuity.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/channels/multichannel/channel-continuity.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-028](../../../../../docs/specs/spec-028.md).
// Tickets: [ZN-0166](../../../../../docs/tickets/zn-0166.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0166 /* planning label, not a public API */
//   OWNER := SPEC-028; TARGET := packages/adapters/src/channels/multichannel/channel-continuity.ts
//   REQUIRE accepted dependencies: ZN-0165
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VERIFY each provider's actual supported webhook scheme, raw bytes and account namespace.
//     PERSIST stable ingress and owned outbox before acknowledgement using shared channel durability patterns.
//     TREAT email headers/chat IDs as provider references, not identity proof; reject header/address injection.
//     BOUND attachments and admit bytes through quarantine/evidence machinery.
//     LINK/rebind identity via fresh challenge and explicit consent; changed recipient triggers new audience check.
//     REOPEN Focus through the same semantic client; carry no prior channel credentials into World authority.
//     PREPARE delivery under current policy and actual provider profile; retain accepted/delivered/read/unknown as observed.
//     QUALIFY real provider accounts; no invented email/Telegram endpoints or offline delivery substitute.
//   TICKET-SPECIFIC SEGMENT:
//     01. Store authority-free Focus and settled interaction references at the relationship level.
//     02. Require separate proof/consent for each channel binding.
//     03. Recompile current authorized context after a channel/audience change.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A user moves from WhatsApp to email then into a work group
//     WHEN They reopen the same subject
//     THEN Context continues only where permitted; the work group does not inherit private personal content
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
