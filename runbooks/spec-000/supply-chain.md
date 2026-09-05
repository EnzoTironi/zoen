# Runbook — secrets, artifacts and merge policy (ZN-0006)

**Status:** implementation-in-progress; not product-accepted.

## Scope

SBOM + provenance from admitted lock; deny promotion when dependencies drift without lock update or when images lack digest/signature; secret scanning with redaction; CODEOWNERS for architecture/security review.

## Commands

```sh
source .toolchain-env.sh
node --experimental-strip-types tooling/supply-chain.ts sbom
node --experimental-strip-types --test tests/component/spec-000/supply-chain.test.ts
```

## Repair

| Symptom | Repair |
|---|---|
| dependency-changed-without-lock-update | Refresh lock via package manager; never hand-edit digests |
| unsigned-image | Sign with admitted identity reference; do not paste private keys into env |
| signing-identity-missing | Set `ZOEN_ADMITTED_SIGNING_IDENTITY` to opaque ref |
| secret finding | Rotate credential; remove from tree; keep redaction |

Disabled route: `release-promotion-and-merge`.
