# Next-model assignment

## Mandate

Continue **implementation and qualification**, not just testing. This candidate is a partial foundation. Preserve the v4 architecture and stable ticket identifiers. Do not reinterpret tests of pure laws as evidence that a database, agent, integration, UI or operating profile exists.

Read `docs/IMPLEMENTATION-STATUS.md`, `evidence/summary.json`, `specification/progress.json`, and the v4 `START-HERE.md`. Extract the original bundle with `python tooling/extract_specification.py`; it verifies the exact source hash and rejects unsafe archive paths. The extracted `specification/v4/` is an ignored reading copy, not the authoritative source ZIP.

## Non-negotiable constraints

All human, agent and app clients must call the same semantic executor. Do not add direct SQL to clients, alternate application data services, a fake PostgreSQL adapter, a local object-store emulator, fabricated OAuth/model/provider responses, a preauthenticated developer user, or an application offline mode. Missing services are blockers. Synthetic records are allowed as real-service test inputs; they do not replace the services.

Never mark a v4 ticket accepted because related source exists or generic tests pass. Respect its dependencies, required evidence, actual scope and independent review. New runtime powers require admitted definitions or isolated artifacts, not permissions supplied by a generated app. Do not reset OS/zoen repositories or assume their data are disposable.

## Execution order on the next machine

1. **Establish provenance and actual toolchain.** Run `git status`, `git log`, `git fsck --full` and the integrity check. Record the source commit. Install the intended Node 24 and exact pnpm version from `package.json`. Verify the candidate dependency versions and security status from official sources. Resolve the complete graph with the real package manager, inspect scripts/peers/provenance, produce and commit a genuine `pnpm-lock.yaml`. Reinstall using `--frozen-lockfile`. Never synthesize a lockfile or type declaration to hide an unavailable dependency.
2. **Compile the entire service against the installed libraries.** `pnpm build` is intentionally stricter than the local core compilation. Fix genuine compatibility/type errors, preserving the shared contracts. In particular validate Better Auth schema/options, the Cedar WASM call/result format, pg role behavior, Hono server interfaces and AWS checksum/conditional-write behavior. Dependency choices here are candidates, not composition proof.
3. **Provision real disposable dependencies.** Follow `runbooks/REAL-QUALIFICATION.md`: a dedicated real PostgreSQL 18 cluster/database, isolated runtime roles, a real private versioned AWS S3 bucket and actual AWS credentials. Do not point fault-injection tests at any production/shared cluster. No emulators.
4. **Validate migrations and the real initial journey.** Run target preflight, migration, provision, full build and `pnpm test:real`. The tests contain real signup/cookies, TCP HTTP, Cedar authorization, PostgreSQL transactions/RLS/connection termination and S3 versioned objects. All ten are currently unexecuted; debug and correct source when they expose defects. Preserve raw results, dependency lock, exact commit and resource profile.
5. **Finish S0, not just its happy-path API.** The candidate lacks the complete EvaluationWorld lifecycle, accessible web journey, production input-schema compilation, release lifecycle, restore/migration proof, admission controls and full observability. Complete the bounded v4 tickets and evidence before considering S0 accepted. Reconcile the conservative domain-locking strategy and image-bound foundation with the full release protocol; do not silently call this runtime ontology publication.
6. **Continue the dependency-ready v4 backlog.** Add Eve and qualified channels, runtime definitions, shared rights, links/apps, actions/effects and later capabilities in the revised v4 sequence. Reuse the executor. In S2/S3/S6, turn current app primitives into real host/session/storage components; do not remove `APP_SESSION_STORAGE_NOT_QUALIFIED` until the required proofs pass. S9–S11 remain the full institutional/finance scope.

## First commands

```sh
python tooling/check_integrity.py
python tooling/extract_specification.py
node tooling/verify-core.mjs
node tooling/mutations.mjs
node tooling/preflight.mjs --real
```

On a correctly provisioned target, after dependency admission and the runbook:

```sh
pnpm build
node --env-file=.env tooling/real-tests.mjs
node --env-file=.env tooling/verify.mjs
```

`.env` is ignored. The runbook explains the deliberately destructive-test consent and cluster-global role restrictions. Passing these tests still does not qualify hosting, scale, recovery, external actions or all 975 v4 checks.

## Preserve failure evidence

Record failures as failures, not “passed with skips.” A missing lock, zero executed tests, wrong compiler/runtime, absent credentials or incompatible dependency must block qualification. Do not reduce tests or weaken policies to make a report green. Create a scoped corrective commit with the failing reproduction and the actual fixed result.

## Expected next handoff

Source commits, admitted lock, current completion matrix, exact commands, raw reports, specific unresolved problems and independent reviews. Do not label the candidate “complete” or publish it to real users solely because `verify-core` succeeds.
