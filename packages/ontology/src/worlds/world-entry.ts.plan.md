# File plan — `packages/ontology/src/worlds/world-entry.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `packages/ontology/src/worlds/world-entry.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-002](../../../../docs/specs/spec-002.md).
Tickets: [ZN-0015](../../../../docs/tickets/zn-0015.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0015 /* planning label, not a public API */
  OWNER := SPEC-002; TARGET := packages/ontology/src/worlds/world-entry.ts
  REQUIRE accepted dependencies: ZN-0014
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    VERIFY provider presence through DoorPort; map stable provider subject, not email/name, to the principal.
    FOR genesis: validate image-pinned seed, operation identity and creation permission; use the existing AuthorityCommit primitive.
    ATOMically create World head, initial membership, domains and genesis receipt/outbox; no account-signup implicit World access.
    FOR entry: read current membership, assurance, purpose, audience and security revision in the authority context.
    ISSUE a random bounded server-side grant stored by digest; Focus and links contain no grant.
    FOR invitation: verify intended recipient, expiry and existing policy; consume once with membership receipt; do not replace the World head.
    AT use and replay: recheck identity, delegation, revision and expiry before disclosure.
    ON revocation: advance deny/security state, reject new use, preserve audit; do not claim to retract delivered data.
  TICKET-SPECIFIC SEGMENT:
    01. Resolve current membership, assurance, purpose, destination and security revision.
    02. Mint opaque random grants stored by hash with bounded expiry; operation permits also bind operation/body/audience/epoch.
    03. Revalidate at use and before disclosure; never copy credentials into Focus.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A grant for billing.read and a request for clinical.note.read
    WHEN The grant is reused with the different operation/purpose
    THEN Access is denied; altered body, realm, audience and expired permit also fail without domain writes
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
