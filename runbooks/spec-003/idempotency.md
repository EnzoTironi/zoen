# ZN-0021 — operation idempotency / fresh replay disclosure (repair)

```text
PRECHECK authority schema includes operations.security_revision.
OBSERVE duplicate operation keys and security_revision vs World head.
PRESERVE the first committed intent digest; never overwrite with changed intent.
ON revocation: advance World security_revision; replays must Denied without disclosing payload.
VERIFY equal requests → one receipt; changed intent → Conflict; revoked disclosure → Denied.
```

Open gate: ZN-0024 chaos still unfinished.
