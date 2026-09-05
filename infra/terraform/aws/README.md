# infra/terraform/aws

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-039](../../../docs/specs/spec-039.md) — Dedicated regional cells, private networking and recovery; [algorithm SPEC-039](../../../docs/algorithms/spec-039.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `dedicated-cell.tf` | required | [read](dedicated-cell.tf.plan.md) |
| `durable-storage.tf` | required | [read](durable-storage.tf.plan.md) |
| `main.tf` | conditional-support | [read](main.tf.plan.md) |
| `outputs.tf` | conditional-support | [read](outputs.tf.plan.md) |
| `residency.tf` | required | [read](residency.tf.plan.md) |
| `restate-ha.tf` | required | [read](restate-ha.tf.plan.md) |
| `variables.tf` | conditional-support | [read](variables.tf.plan.md) |
| `versions.tf` | conditional-support | [read](versions.tf.plan.md) |

Shared invariants and dependencies: [repository contract](../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
