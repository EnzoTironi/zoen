# Runbook — real dependency test harness (ZN-0004)

**Status:** implementation-in-progress; not product-accepted.

## Scope

Vitest + fast-check + Playwright configs; disposable PostgreSQL/MinIO via `compose.test.yaml`; controllable clocks and named barriers in test-only composition. Missing prerequisites fail closed (never skip).

## Commands

```sh
source .toolchain-env.sh
# Unconfigured PG profile must fail (not skip):
node --experimental-strip-types tooling/test-harness.ts postgres-unconfigured

# Tools-only admitted profile:
node --experimental-strip-types -e 'import { runHarness } from "./tooling/test-harness.ts"; console.log(await runHarness({ profileName: "component-harness" }))'

# Optional full stack:
docker compose -f compose.test.yaml up -d
export ZOEN_TEST_DATABASE_URL=postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness
export ZOEN_TEST_S3_ENDPOINT=http://127.0.0.1:59000
```

## Repair

| Symptom | Repair |
|---|---|
| MissingPrerequisite vitest/playwright | Restore pinned devDependencies + lock from registry |
| MissingPrerequisite ZOEN_TEST_DATABASE_URL | Start compose or export URL; never mock PG |
| Zero executedCount | Treat as failure; do not certify |
| Barrier/clock imported in apps/* | Remove — test-only APIs |

## Preserve

Do not fabricate image digests. Ticket stays unaccepted until independent review + verify:ticket (ZN-0005).
