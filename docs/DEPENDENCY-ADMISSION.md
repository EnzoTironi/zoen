# Dependency admission — currently blocked

`package.json` pins candidate direct dependencies. They were not installed in the delivery environment and are not an admitted lock. No fabricated `pnpm-lock.yaml`, integrity field, container image digest, `node_modules`, type shim or package cache is included.

| Concern | Intended target | Actually executed here |
|---|---|---|
| Node | 24.x, exact patch to admit | 22.16.0 |
| TypeScript | 6.0.3 candidate from v4 | Global 5.8.3 for the dependency-independent core only |
| pnpm | 11.25.0 candidate | Not installed |
| PostgreSQL | 18.x, exact patch/image to admit | Not installed |
| External libraries | Exact candidate pins in `package.json` | Not installed, syntax review only |
| AWS S3 | Actual private versioned bucket | Not contacted |

Primary documentation was consulted for actual library interfaces. Published version metadata is not proof of compatibility or security. In particular, observing a newer TypeScript major is not authorization to silently replace the v4 target. Confirm actual availability and record a reviewed amendment if a requested version cannot be admitted.

## Required target procedure

Use an actual network-enabled environment. Verify Node/pnpm provenance. Review each dependency and its transitive graph, licenses, advisories, peer requirements and lifecycle scripts. The candidate has `ignore-scripts=true` by default; explicitly approve any genuinely required scripts rather than enabling arbitrary scripts globally. Use the real package manager to resolve and produce a lock. Record exactly which packages required scripts and why.

Perform `pnpm install` for the initial reviewed resolution, commit the resulting real lock, remove dependencies, and reproduce with `pnpm install --frozen-lockfile`. Run `pnpm build` with installed types and real libraries, then actual service qualification. Do not use `skipLibCheck`, broad `any`, ambient module declarations, permissive SDK stubs or reduced test coverage to conceal incompatibility.

A registry download, successful import or build does not qualify an external provider integration. Record exact PostgreSQL minor, cloud region, bucket configuration, schema hash, role grants, runtime and immutable source commit with the real-service report. Node/SQL/image compatibility and recovery must be demonstrated, not inferred from version numbers.
