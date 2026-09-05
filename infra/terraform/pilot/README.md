# infra/terraform/pilot

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-049](../../../docs/specs/spec-049.md) — Shared hosted pilot and progressive product activation; [algorithm SPEC-049](../../../docs/algorithms/spec-049.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `capability-admission.tf` | required | [read](capability-admission.tf.plan.md) |
| `main.tf` | conditional-support | [read](main.tf.plan.md) |
| `outputs.tf` | conditional-support | [read](outputs.tf.plan.md) |
| `pilot-rollout.tf` | required | [read](pilot-rollout.tf.plan.md) |
| `pilot-topology.tf` | required | [read](pilot-topology.tf.plan.md) |
| `variables.tf` | conditional-support | [read](variables.tf.plan.md) |
| `versions.tf` | conditional-support | [read](versions.tf.plan.md) |

Shared invariants and dependencies: [repository contract](../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
