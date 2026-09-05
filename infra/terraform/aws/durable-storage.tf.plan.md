# File plan — `infra/terraform/aws/durable-storage.tf`

**Status:** planned; no product acceptance implied.

Target: `infra/terraform/aws/durable-storage.tf`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-039](../../../docs/specs/spec-039.md).
Tickets: [ZN-0226](../../../docs/tickets/zn-0226.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0226 /* planning label, not a public API */
  OWNER := SPEC-039; TARGET := infra/terraform/aws/durable-storage.tf
  REQUIRE accepted dependencies: ZN-0225
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    SELECT reviewed regional profile, immutable infrastructure/dependency/image identities and secret references.
    PROVISION actual separated edge/Eve/authority/effect/runner identities, databases, object namespaces and private network routes.
    ENFORCE residency/keys/least privilege using native provider controls; record measured operating limits.
    BACK UP with coherent manifests, deletion ledger and escaped-effect references; test on disposable real infrastructure.
    RESTORE read-only with all dispatch disabled; reconcile current erasure suppression and provider ambiguity.
    VERIFY rights, pins, role separation and current coordinator epoch before write admission.
    REQUIRE operator/security evidence for that exact account/region/profile; Terraform existence is not an admitted cell.
    ROLL back only compatible code or a proved forward schema/data repair; retain source tenant data until approved cutover.
  TICKET-SPECIFIC SEGMENT:
    01. Provision supported HA PostgreSQL, encrypted evidence, backup/PITR and separate catalog state.
    02. Configure narrowly scoped runtime roles and key policies.
    03. Verify object retention pins and database/evidence recovery relationships.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN One database node fails and an object key becomes unavailable
    WHEN The cell’s normal reads and recovery checks run
    THEN HA behavior is measured; missing evidence is explicit and no failover fabricates source data
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
