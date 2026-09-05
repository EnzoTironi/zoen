# Implemented call path and boundaries

## One semantic path

`Hono request → strict semantic HTTP adapter → real Better Auth session resolution → SemanticExecutor → Authority → real Cedar policy + PostgreSQL transaction`

An admitted evidence read additionally uses the real AWS S3 adapter outside the authority transaction and reauthorizes before returning. The CLI uses the same HTTP operation envelopes. It does not query SQL. A future agent/app transport must terminate at the same executor; no second business backend is authorized by this candidate.

The HTTP adapter handles origin, byte limits, parsing, authenticating context and result rendering. SQL and policy remain outside clients. Client fields cannot choose a principal, role or app capability. Native cryptographic signatures attest bytes, not permissions.

## Initial operations

| Operation | Behavior represented in source |
|---|---|
| `CreatePersonalWorld` | Atomic private World, membership, genesis receipt and outbox; same-intent key reuse |
| `Discover` | The initial admitted-operation descriptions, not placeholders for the future backlog |
| `RegisterSource` | Attributed source, visibility and source-family identity |
| `CreateSubject` | An initial `record` subject |
| `StageEvidence` | Exact bounded source text/JSON in real versioned S3 plus governed metadata |
| `AdmitClaim` | Claim with unit/scope/time, provenance and retained evidence refs |
| `CorrectClaim` | Scoped attributed correction retaining its predecessor; fresh-basis guard |
| `Inspect` | Authorized claims grouped by comparability; disagreement remains explicit; pinned Frame |
| `OpenFrame` | Reopen the user's retained Frame with current rights and expiry checks |
| `OpenEvidence` | Reopen exact authorized evidence through the same executor; no credential-bearing object URL |

These handlers need real-service qualification. No generated response or in-memory state stands in for a successful external call.

## Persistence and decisions

World-scoped foreign keys and RLS complement the semantic layer. World/session context comes from verified server inputs. Authority role grants disallow updates/deletes to retained claims, evidence and receipts. Door uses a separate role/schema. Outbox workers receive only their queue role. Migrators have an explicit operator-only profile.

SERIALIZABLE mutations use ordered domain guards, same-intent identities and atomic receipts/outbox. Snapshot reads are REPEATABLE READ. Unknown commit acknowledgment is represented as `Unknown`, not success/failure invented from a disconnected socket. Only specific serialization/deadlock errors are retried. No model/provider network call belongs inside the SQL work callback.

The actual PostgreSQL enforcement and full failure matrix remain untested in this environment.

## Divergence and learning

Comparability includes subject/property, semantic definition, scope, unit and valid-time meaning. Unknown time does not establish equal time. Source-family/derivation relationships reduce double counting; there is no majority vote that equates copied records with independent proof. Visibility filtering precedes reconciliation. A hidden successor must not suppress a claim visible to the current user.

A correction is attributed and scoped; it does not overwrite history, certify independent truth or become a reusable global rule. The initial executor offers only its fixed foundation; complete runtime learning/publishing remains in v4.

## Mini apps and expressions

The closed expression interpreter has no arbitrary code/network/SQL operator. The app manifest accepts only the supported read-only components and ordinary read operations. Executable data exposure requires a qualified profile; a signature or iframe is not assumed to prevent copying data.

Current helpers validate restrictions, but there is no persistent app session host or secure link exchange. All live app-session execution is denied until that implementation and its gates exist. Rivet is not installed or used by the candidate.

## Scope and deployment

This is a strict TypeScript modular repository, not microservices. The initial implementation uses a root package manifest; full pnpm workspace/quality/release automation is still to implement. Empty product scaffolds are not counted as features. The edge is loopback-only, requires actual services and has no supported production deployment image.
