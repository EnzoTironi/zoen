# File plan — `runbooks/spec-001/laws.md`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `runbooks/spec-001/laws.md`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-001](../../docs/specs/spec-001.md).
Tickets: [ZN-0012](../../docs/tickets/zn-0012.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

## ZN-0012 operational/repair procedure

Scope: Prove algebraic and resource-limit laws. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The law suite runs on two locales/timezones
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
INPUT: untrusted bytes or scalar plus explicit schema, precision, unit and temporal policy.
CHECK byte/depth/entry limits before recursive parsing; reject duplicate keys, invalid Unicode and remote schema references.
PARSE IDs before branding; bind World and realm, never treat an opaque ID as authorization.
NORMALIZE decimals with exact arithmetic, explicit rounding and checked scale/overflow; zero and missing remain different.
COMPARE units only with equal dimensions/currency or a released evidenced conversion; never guess locale.
PARSE Instant, LocalDate and wall time as different types; require an explicit choice for ambiguous wall time.
CANONICALIZE admitted values deterministically and hash actual canonical bytes; no network or environment access.
RETURN tagged errors without partial branding; preserve counterexamples for generated-law tests.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Results and canonical digests agree and oversized input fails within configured memory/time limits
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-001
parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.

No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.

[algorithm SPEC-001](../../docs/algorithms/spec-001.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
