# Runbook — workspace, strict build and dependency boundaries (ZN-0003)

**Status:** implementation-in-progress; not product-accepted.

## Scope

Create apps/packages layout per `docs/architecture/repository-contract.md`, enforce strict TypeScript + ESLint/dependency-cruiser configs, and require `check` / `test:law` / `test:component` / `test:journey` / `verify:ticket` scripts. Forbidden edges (Eve→pg, web→authority credentials) must fail the static checker.

## Preconditions

- ZN-0002 core toolchain admission artifact present (`admissions/spec-000/execution-lock.json`). Unaccepted deps may still block merge.
- Node 24 + pnpm 11 from admitted profile; source `.toolchain-env.sh`.
- Resource locks: `contract:kernel-and-tooling`, `module:tooling`.

## Observe

```sh
source .toolchain-env.sh
node --experimental-strip-types tooling/workspace.ts check
node --experimental-strip-types --test tests/static/spec-000/workspace.test.ts
```

Record: commit, lock digest, fixture seed `zn-0003-workspace-seed-v1`, finding codes, artifact digest.

## Typical failures

| Symptom | Likely cause | Repair |
|---|---|---|
| `missing-app-unit` / `missing-package-unit` | Incomplete workspace skeleton | Restore `package.json`, `tsconfig.json`, `src/index.ts` under allowlist |
| `missing-required-script` | Altered root `package.json` | Restore `check`, `test:law`, `test:component`, `test:journey`, `verify:ticket` |
| `eve-forbidden-pg-adapter` | Eve imported `pg` / adapters/pg | Remove import; use contracts ports only |
| `web-forbidden-authority-credential` | Web read authority env / pg | Route data through semantic client only |
| `placeholder-route-exposed` | Fake provider success route | Delete stub; keep capability disabled |
| `verify:ticket` exits 1 | Expected until ZN-0005 | Do not fake success |

## Preserve

- Do not fabricate eslint/dependency-cruiser package digests; configs are present, packages remain `not-admitted` in the report.
- Do not mark ZN-0003 accepted; independent review + `verify:ticket` required.
- Keep unrelated tenant/scopes untouched; no force-push to main.

## Resume

Only after independent review and evidence validation. Disabled route: `workspace-boundaries-implementation-and-merge`.
