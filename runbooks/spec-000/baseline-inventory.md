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

## Initial inventory command

From the workspace root, capture a new baseline only when the artifact does not exist. The command reads the remote repositories and writes the local artifact exclusively; it refuses to replace earlier evidence.

```sh
node --experimental-strip-types --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { runBaselineInventory } from './tests/admission/spec-000/baseline-inventory.test.ts';
const inventory = runBaselineInventory();
writeFileSync(
  'admissions/spec-000/baseline-inventory.json',
  JSON.stringify(inventory, null, 2) + '\n',
  { flag: 'wx' },
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

## Reverify the recorded baseline

The required suite reads immutable source snapshots using the recorded commit pins. It observes each current branch head before and after the reads to check that the repositories stayed unchanged during that run. A later commit on `main` does not replace the selected snapshot or invalidate its historical contents.

Only a confirmed HTTP 404 records an optional LICENSE or Cargo.toml as absent. DNS, TLS, process and other HTTP failures stop the command as unavailable. An incomplete artifact, duplicate repository identity or missing observation is rejected before it can qualify the baseline.

The AC check also reads the real zoen predecessor `407da157771807ce397529a50a67bc8964a335b6` to prove verification works after a branch head advances. NEG exercises malformed records directly, and BOUNDARY tests pure transport-result classification plus explicit pin/digest drift. No HTTP service is simulated.

Catalog entries distinguish `repository-path`, `archive-path` and `conceptual-label` with `pathKind`. The six conceptual labels preserve the previous planning categories and decisions; their `path` strings assert no repository location. They stay evidence-absent and cannot qualify a direct import. The anonymous GitHub tree read at OS pin `88bfa34a9bcc1a793f1e6b2d7574bad033b44f25` confirmed the eight actual repository paths and the absence of those six labels. Its raw-response digest is appended to the original observations; the original pins, timestamp, license conflict and live-data unknown state remain recorded.

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
4. **REPAIR** by re-running the required suite against the recorded pins; preserve the original artifact. A new baseline selection requires a reviewed change that retains the previous evidence. Never invent license, digest, tenant list, or lock entries.
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
