# File plan — `infra/terraform/aws/restate-ha.tf`

**Status:** planned; no product acceptance implied.

Target: `infra/terraform/aws/restate-ha.tf`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-039](../../../docs/specs/spec-039.md).
Tickets: [ZN-0227](../../../docs/tickets/zn-0227.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0227 /* planning label, not a public API */
  OWNER := SPEC-039; TARGET := infra/terraform/aws/restate-ha.tf
  REQUIRE accepted dependencies: ZN-0226
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
    01. Use the exact supported replicated/persistent deployment for the admitted server version.
    02. Test restart/failover and handler identity compatibility.
    03. Restore with dispatch fenced until canonical intents and external unknowns are reconciled.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Restate fails after a provider accepted an effect but before workflow progress is durable
    WHEN The deployment fails over
    THEN Canonical Ontology state controls reconciliation; no unsafe duplicate effect is sent merely because the durable executor resumed
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
