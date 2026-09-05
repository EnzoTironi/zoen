# Runbook — SPEC-000 execution lock / core toolchain (ZN-0002)

**Status:** implementation-in-progress; not product acceptance.  
**Primary artifact:** `admissions/spec-000/execution-lock.json`  
**Schema:** `contracts/spec-000/execution-lock.schema.json`

## Purpose

Admit the exact core toolchain (Node, pnpm, TypeScript, Hono, pg, PostgreSQL, Cedar binding, schema validator, canonicalizer, test tools, image digests) with **real** integrity from primary registries. Never invent lock hashes. Missing binaries or failing probes **block** core admission.

## Preconditions

- Node satisfying `package.json` engines (`>=24 <25`), preferably via `.toolchain-env.sh` / nvm.
- `pnpm` matching `packageManager` when generating workspace locks.
- Docker available for PostgreSQL 18 probe image.
- Read-only access to `registry.npmjs.org`, `nodejs.org`, Docker Hub.
- No fabricated integrity, image digest, or probe success.

## Admission command

```sh
source .toolchain-env.sh
node --experimental-strip-types --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { runExecutionLockAdmission } from './tests/admission/spec-000/execution-lock.test.ts';
const lock = await runExecutionLockAdmission();
writeFileSync(
  'admissions/spec-000/execution-lock.json',
  JSON.stringify(lock, null, 2) + '\n',
);
console.log({
  admissionStatus: lock.admissionStatus,
  identical: lock.cleanInstalls.identicalIntegrity,
  blockers: lock.blockers.map((b) => b.code),
  probes: Object.fromEntries(
    Object.entries(lock.compatibilityProbes).map(([k, v]) => [k, v.status]),
  ),
});
JS
```

Observations performed:

1. Two independent npm registry resolutions of the candidate package set; require identical integrity digests.
2. Node `v24.20.0` SHASUMS256 artifacts from nodejs.org (not invented).
3. Docker Hub digests for `postgres:18` and `node:24`.
4. Compatibility probes: Hono streaming, pg transaction, Cedar deny, schema/canonicalizer.
5. Record local Node/pnpm honestly; do not fake Node 24.
6. Leave unresolved families (schema validator, RFC8785 canonicalizer npm pins, vitest/playwright) as **BLOCKED**.

## Required checks

```sh
source .toolchain-env.sh
node --experimental-strip-types --test tests/admission/spec-000/execution-lock.test.ts
```

Exact IDs: `ZN-0002-AC`, `ZN-0002-NEG`, `ZN-0002-BOUNDARY`.

`pnpm verify:ticket --ticket ZN-0002` is delivered by later SPEC-000 tickets. Until that target exists, report **BLOCKED** for verify tooling and attach the node test output above.

## Failure / repair

1. **PRECHECK** profile `admission-core-toolchain`, operator authority, ticket evidence.
2. **STOP** core implementation merges that depend on an AdmittedLock while status is BLOCKED.
3. **OBSERVE** raw registry/probe errors; preserve digests and blocker codes.
4. **REPAIR** by re-running the admission command against real registries; never invent integrity or image digests. Select exact schema-validator/canonicalizer packages only via reviewed package.json change.
5. **VERIFY** AC + NEG + BOUNDARY on the real command boundary.
6. **RESUME** only after independent review. Incomplete, expired, or digest-mismatched qualification artifacts remain blocked; previous evidence does not transfer silently when versions/digests change.

## Integrity rule

If a digest cannot be obtained honestly, leave an explicit `BLOCKED`/`unresolved` field. Do not rename this runbook or a plan into a passing lock.
