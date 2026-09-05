// @zoen-plan packages/adapters/src/channels/whatsapp/webhook.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/channels/whatsapp/webhook.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/channels/whatsapp/webhook.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-011](../../../../../docs/specs/spec-011.md).
// Tickets: [ZN-0064](../../../../../docs/tickets/zn-0064.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0064 /* planning label, not a public API */
//   OWNER := SPEC-011; TARGET := packages/adapters/src/channels/whatsapp/webhook.ts
//   REQUIRE accepted dependencies: ZN-0057, ZN-0062
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VERIFY exact admitted provider signature/replay contract on raw bytes before parsing; do not invent headers.
//     CHECK account namespace, payload limits and event identity; persist ingress and owned outbox before ACK.
//     DEDUPLICATE provider replay by stable event identity and dispatch one Eve turn after durable admission.
//     BIND channel to principal only via verified secure challenge and explicit consent; sender number is not a World grant.
//     CREATE authority-free continuation through SPEC-051; preview GET/HEAD is generic and consumes nothing.
//     BEFORE sending recheck audience, current disclosure, consent, provider template/window rules and enabled qualification.
//     PERSIST delivery intent then call the real provider outside authority transaction; observe actual accepted/delivered/unknown evidence.
//     ON lost acknowledgement reconcile known provider identity; never synthesize delivered status or blindly duplicate a consequential send.
//   TICKET-SPECIFIC SEGMENT:
//     01. Implement versioned provider verification against published fixtures.
//     02. Preserve stable provider/account/event identity and replay protection.
//     03. Atomically write channel ingress and outbox before returning provider success.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Duplicate signed webhook and a process kill immediately before/after durable admission
//     WHEN The provider retries
//     THEN Valid ingress is accepted once; invalid signatures are rejected; no success ACK precedes durability
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
