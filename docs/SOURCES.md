# Primary-source research used for adapter source

Research context: 2026-09-04 (America/Sao_Paulo). These are interface/design sources, not evidence that their dependencies were installed or executed in this container. Candidate source must be checked against the exact admitted package.

| Primary source | Purpose |
|---|---|
| https://node-postgres.com/features/transactions | Real pg client-scoped transactions; no pool-wide transaction substitute |
| https://www.postgresql.org/docs/18/ddl-rowsecurity.html | Role and RLS behavior to test on actual PostgreSQL |
| https://www.postgresql.org/docs/18/transaction-iso.html | Snapshot/serialization contracts, requiring real concurrency tests |
| https://better-auth.com/docs/adapters/postgresql | PostgreSQL adapter contract |
| https://better-auth.com/docs/reference/options | UUID, sessions, password and origin configuration |
| https://github.com/better-auth/better-auth/releases/tag/v1.7.2 | Candidate release metadata, not successful integration |
| https://hono.dev/docs/getting-started/nodejs | Real Node HTTP host integration |
| https://github.com/honojs/hono/releases/tag/v4.13.7 | Candidate Hono release metadata |
| https://github.com/cedar-policy/cedar/tree/main/cedar-wasm | Real Cedar WASM packaging and host interface |
| https://github.com/cedar-policy/cedar/blob/main/cedar-policy/src/ffi/is_authorized.rs | Authorization FFI request/response shape to verify against admitted version |
| https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html | Conditional immutable writes and version/checksum behavior |
| https://raw.githubusercontent.com/aws/aws-sdk-js-v3/v3.1116.0/clients/client-s3/package.json | AWS S3 candidate SDK version |

The unchanged v4 bundle contains the broader product, Rivet, mini-app and institutional source ledgers. No claim of Palantir/Bloomberg parity or full production capability follows from those references.
