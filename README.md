# Zoen v4 — partial implementation candidate

**This repository is not the completed v4 product, not production-ready, and not a substitute for the v4 specification. No v4 ticket has independent acceptance.**

This is a real local Git repository containing an initial TypeScript implementation, strict input and domain-law tests, actual cryptographic tests, SQL migration source, real external adapter source, and a real-service qualification suite. There are no substitute databases, fake providers, authentication bypasses, or application offline modes.

The delivery environment could run Node 22.16.0 and TypeScript 5.8.3. It could not install the target Node 24 / TypeScript 6 toolchain or external packages, and had no PostgreSQL server. Therefore **the service adapters, complete application build and database tests have not been validated**. The next machine needs to finish implementation as well as perform qualification; it does not merely need to test a finished platform.

## Start here

Read [implementation status](docs/IMPLEMENTATION-STATUS.md), [the next-model assignment](NEXT-MODEL.md), and [validation evidence](evidence/summary.json). The unchanged [v4 specification ZIP](specification/zoen-execution-v4.zip) remains the product scope. [Ticket progress](specification/progress.json) records all 325 tickets as unaccepted; local test results have not been substituted for the 975 required product checks.

## What has implementation source

- Strict JSON, exact decimals, time, typed results, bounded graphs and canonical digests.
- Attributed claims, comparability, divergent interpretations, source-independence rules and scoped corrections.
- A single semantic executor with ten initial operation handlers; PostgreSQL transaction, guard, idempotency, receipt and outbox logic.
- Real PostgreSQL, Cedar WASM, Better Auth, Hono and AWS S3 adapter source; a thin HTTP client and CLI.
- Closed expression evaluation, declarative read-only app definitions and link/session restriction primitives. These are not a deployed runtime Studio or protected app host.

The [architecture note](docs/ARCHITECTURE.md) identifies the deliberately narrow foundation and the major contracts not yet implemented.

## Validation commands

```sh
# Local core only: requires a real TypeScript compiler, but no services.
node tooling/verify-core.mjs
node tooling/mutations.mjs

# Full target checks: missing actual dependencies/resources yield a nonzero exit.
node tooling/preflight.mjs --real
node tooling/verify.mjs
```

The first two commands exercise actual code, not an alternate application mode. Their success does not qualify the real service. A successful core command alongside a blocked full verification is expected in the delivery environment.

For real infrastructure installation, use [the qualification runbook](runbooks/REAL-QUALIFICATION.md). Do not run database or S3 tests against production. Runtime provisioning refuses existing role names to avoid modifying cluster-global identities belonging to another installation.

## What is not delivered

Eve/model-provider conversations, WhatsApp, the accessible web product, complete runtime releases, secure hosted mini apps, Rivet qualification, search/dense data, enterprise operations, federation and finance execution remain unimplemented. Even the initial S0 milestone is not accepted. No remote repository was changed, no live data was migrated and no external capability was activated.
