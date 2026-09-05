// @zoen-plan packages/adapters/src/channels/multichannel/email.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/channels/multichannel/email.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/channels/multichannel/email.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-028](../../../../../docs/specs/spec-028.md).
// Tickets: [ZN-0165](../../../../../docs/tickets/zn-0165.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0165 /* planning label, not a public API */
//   OWNER := SPEC-028; TARGET := packages/adapters/src/channels/multichannel/email.ts
//   REQUIRE accepted dependencies: ZN-0164
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
//     01. Verify provider event signatures over raw payloads.
//     02. Preserve message/thread identity without treating From as authenticated authority.
//     03. Reject header injection and route attachments through evidence quarantine.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A spoofed From header names the World owner and asks for a confidential export
//     WHEN The email is admitted as transport input
//     THEN No owner grant is inferred; confidential action remains denied pending secure identity/approval
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
