# Hosted gates operator checklist (H-01 / H-02 / G-OPS / G-STORAGE-FENCE)

**Status:** tip keeps `H-01`/`H-02`/`G-STORAGE-FENCE: Blocked`, `G-OPS: Unknown`, and `fullHostedErased: false`. This checklist + `pnpm ops:prep-hosted-gates` produce **prep evidence only**. They never destroy `zoen` / `zoen-rebuild` / `zoen_data`, never provision managed Postgres, never alchemy-adopt production, and never claim Full hosted Erased.

## Gate honesty

| Gate | Tip posture | What prep may do | What prep must NOT do |
| --- | --- | --- | --- |
| **H-01** independent erasure controller | **Blocked** | Document local ZA-11 compose seam (`ops/compose.erasure-controller.yaml`); record absence of approved hosted controller footprint | Advertise hosted controller independence; flip tip to Qualified |
| **H-02** hosted erasable target | **Blocked** | Dry-run refuse/admit checks for an **explicit** candidate identity; refuse legacy/retained names | Bind live `zoen` / `zoen-rebuild` / bucket `zoen` / volume `zoen_data` as erasable; destroy/recreate retained installs |
| **G-OPS** live erasable inventory | **Unknown** | Point operator at read-only `ops/fly/scripts/inventory.sh` (secret **names** only); keep coverage Unknown until Enzo re-binds erasable inventory | Treat inventory capture as Qualified erasable inventory; run destroy/scale-stop against retained apps as “prep” |
| **G-STORAGE-FENCE** writer containment | **Blocked** | Reaffirm Object Lock ≠ writer fence; point at ZA-10 settlement tests | Claim credential-retirement / late-PUT fence Qualified from Object Lock alone |
| `fullHostedErased` / `productAccepted` / `restoreAfterErasure` | **false** | Echo literals in evidence JSON | Set any to true |

## Hard refusals (always)

- Destroy, stop, or volume-delete **`zoen-rebuild`**, legacy **`zoen`**, or volume/bucket **`zoen_data` / `zoen`**.
- Managed Postgres / Tigris Worlds data-plane cutover as part of this prep.
- Alchemy production adopt / DNS cutover (`ops/alchemy/README.md` remains out of scope).
- Fabricating an “authorized” H-02 target without Enzo written identity.
- Flipping `docs/verification/frontier-status.json` gates from this checklist alone.

## One command (fail-closed)

From repo root:

```bash
pnpm ops:prep-hosted-gates
```

Equivalent:

```bash
python3 tests/integration/hosted/gates/prep.py
```

Optional staging-only candidate dry-run (JSON file; never mutates remote):

```bash
pnpm ops:prep-hosted-gates -- --candidate /path/to/candidate.json
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Reserved — not used while product gates stay closed (prep never “passes” Full Erased) |
| `2` | **Fail-closed prep complete** — evidence under `.local/hosted-gates-prep/`; tip gates stay Blocked/Unknown; `fullHostedErased` false |
| `1` | Invalid candidate JSON / protected-resource attempt flagged as operator error input |

The script **never** runs `fly apps destroy`, `fly volumes destroy`, `fly postgres`, or alchemy adopt.

## After prep

1. Keep `.local/hosted-gates-prep/prep.json` as local operator evidence (gitignored via `.local/`).
2. To advance a gate, open an **intentional** tip evidence PR with real authority + tip SHA/lockfile/image — do not flip gates from prep alone.
3. Live G-OPS inventory (read-only) remains `ops/fly/scripts/inventory.sh` when Enzo authorizes capture; still does not auto-Qualify G-OPS.
4. G-PROVIDER live qualify stays separate (`pnpm eve:qualify-gprovider`) and is **out of scope** here.

## Fail-closed proofs (no Fly / no destroy)

```bash
python3 -m unittest discover -s tests/integration/hosted/gates -p 'test_*.py'
pnpm exec vitest run --project unit ops/fly/erasable-target.test.ts
```

## Evidence template

Copy shape: [`docs/verification/templates/hosted-gates-evidence.template.json`](../verification/templates/hosted-gates-evidence.template.json).

## Related

- [`docs/verification/hosted-erasable-admission.md`](../verification/hosted-erasable-admission.md) — ZA-14 admission posture
- [`docs/verification/erasure-object-writer-containment.md`](../verification/erasure-object-writer-containment.md) — G-STORAGE-FENCE honesty
- [`ops/fly/erasable-target.ts`](../../ops/fly/erasable-target.ts) — read-only refuse/admit helper
- [`ops/compose.erasure-controller.yaml`](../../ops/compose.erasure-controller.yaml) — local ZA-11 controller seam (not H-01 hosted)
- [`docs/ops/eve-gprovider-operator-runbook.md`](./eve-gprovider-operator-runbook.md) — separate Eve/G-PROVIDER path
