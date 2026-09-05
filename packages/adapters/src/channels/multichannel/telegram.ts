// @zoen-plan packages/adapters/src/channels/multichannel/telegram.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/channels/multichannel/telegram.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/channels/multichannel/telegram.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-028](../../../../../docs/specs/spec-028.md).
// Tickets: [ZN-0164](../../../../../docs/tickets/zn-0164.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0164 /* planning label, not a public API */
//   OWNER := SPEC-028; TARGET := packages/adapters/src/channels/multichannel/telegram.ts
//   REQUIRE accepted dependencies: ZN-0068, ZN-0111, ZN-0158
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
//     01. Admit documented webhook secret verification and owned bot/account configuration.
//     02. Use stable update/chat/message namespaces and durable admission-before-ACK.
//     03. Track send observations without inventing delivery/read evidence.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A duplicate update and one with an invalid webhook secret arrive
//     WHEN The adapter processes them
//     THEN The valid update creates one turn; the invalid update is rejected and cannot impersonate a bound principal
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
