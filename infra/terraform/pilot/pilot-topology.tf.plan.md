# File plan — `infra/terraform/pilot/pilot-topology.tf`

**Status:** planned; no product acceptance implied.

Target: `infra/terraform/pilot/pilot-topology.tf`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-049](../../../docs/specs/spec-049.md).
Tickets: [ZN-0287](../../../docs/tickets/zn-0287.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0287 /* planning label, not a public API */
  OWNER := SPEC-049; TARGET := infra/terraform/pilot/pilot-topology.tf
  REQUIRE accepted dependencies: ZN-0051, ZN-0073
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    PROVISION the actual admitted shared profile with separate edge/Eve/authority identities and private storage.
    SERVE only qualified core/web/file capabilities initially; channel/model/effect/runtime gates are independent.
    KEEP identity, authority, evidence, erasure and idempotency identical to larger cells.
    ADMIT owner-only continuation and declarative apps without requiring Rivet/dense/enterprise features.
    MEASURE backup/recovery/capacity against the limited profile; no Fortune-500 availability claim from pilot size.
    ENABLE each capability using commit-bound code/provider evidence plus current approval.
    ROLL out signed image and compatible schema with health checks and explicit stop/repair path.
    KEEP executable apps and all sensitive unqualified routes disabled until their exact host/runner tests pass.
  TICKET-SPECIFIC SEGMENT:
    01. Create private authority database, evidence store, public edge/web and separate Eve/authority workload identities.
    02. Exclude Iceberg/catalog/custom runner/GPU services from the early profile.
    03. Verify exact region/version availability and record explicit single-node/non-HA limitations where present.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN The S1 product is ready without S7/S9 features
    WHEN The pilot environment is provisioned
    THEN Only necessary services are installed and its isolation/backup behavior is tested; enterprise capacity/HA is not claimed
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
