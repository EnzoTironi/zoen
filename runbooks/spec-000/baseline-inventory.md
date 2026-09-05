# Runbook — SPEC-000 baseline inventory (ZN-0001)

**Status:** implementation-in-progress; not product acceptance.  
**Primary artifact:** `admissions/spec-000/baseline-inventory.json`  
**Schema:** `contracts/spec-000/baseline-inventory.schema.json`

## Purpose

Record commit-pinned repository and data-preservation baseline before any destructive migration work. OS remains a read-only migration source. Live tenant/production-data inventory stays **unresolved** until the owner supplies it. Never reset the OS deployment to obtain a green run.

## Preconditions

- Read-only network access to `https://github.com/EnzoTironi/OS` and `https://github.com/EnzoTironi/zoen`.
- Local workspace contains `archives/zoen-execution-v4.zip` matching `docs/lineage/source-ledger.md`.
- No write credentials, deploy tokens, or OS mutation authority.
- `GIT_TERMINAL_PROMPT=0`; do not `git push`, `git commit` in foreign clones, or force-push.

## Inventory command (read-only)

From the workspace root:

```sh
node --experimental-strip-types --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { runBaselineInventory } from './tests/admission/spec-000/baseline-inventory.test.ts';
const inventory = runBaselineInventory();
writeFileSync(
  'admissions/spec-000/baseline-inventory.json',
  JSON.stringify(inventory, null, 2) + '\n',
);
console.log({
  os: inventory.repositories[0].commit,
  zoen: inventory.repositories[1].commit,
  live: inventory.liveDataPreservation.status,
});
JS
```

Equivalent observations performed by the command:

1. `git ls-remote https://github.com/EnzoTironi/OS.git refs/heads/main` (pre)
2. `git ls-remote https://github.com/EnzoTironi/zoen.git refs/heads/main` (pre)
3. Fetch LICENSE / `package.json` / `Cargo.toml` via public raw URLs at the pinned SHAs
4. `sha256sum archives/zoen-execution-v4.zip` and compare to ledger digest `a373b45f…`
5. Classify reused components as `import` | `rewrite` | `discard` (default **rewrite** when evidence is absent; discard Rust kernel / DB schema / old Eve topology / OS deploy)
6. Record `liveDataPreservation.status = unresolved` (never empty)
7. `git ls-remote` again (post) and require pre=post for both repos

## Required checks

```sh
node --experimental-strip-types --test tests/admission/spec-000/baseline-inventory.test.ts
```

Exact IDs: `ZN-0001-AC`, `ZN-0001-NEG`, `ZN-0001-BOUNDARY`.

`pnpm verify:ticket --ticket ZN-0001` is delivered by later SPEC-000 tickets. Until that target exists, report **BLOCKED** for verify tooling and attach the node test output above.

## Failure / repair

1. **PRECHECK** profile `admission-read-only`, operator authority, ticket evidence.
2. **STOP** destructive migration / OS reset for the affected scope.
3. **OBSERVE** raw inventory errors; preserve original commits and digests.
4. **REPAIR** by re-running the read-only inventory command; never invent license, digest, tenant list, or lock entries.
5. **VERIFY** AC + NEG + BOUNDARY on the real command boundary.
6. **RESUME** only after independent review. Incomplete, expired, or commit-mismatched qualification artifacts remain blocked; previous evidence does not transfer silently when pins change.

## Live-data rule

If owner-supplied tenant inventory is still missing, keep:

```json
"liveDataPreservation": {
  "status": "unresolved",
  "inventory": "unknown",
  "tenantsVerified": false,
  "ownerSupplyRequired": true,
  "osDeploymentResetForbidden": true
}
```

Do not replace this with `[]`, `{}` success, or a fabricated empty tenant list.
