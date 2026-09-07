# Legacy `zoen` → `zoen-rebuild` hostname cutover

**Authorized (Enzo):** replace public hostname `zoen.tironi.xyz` onto Fly app `zoen-rebuild`.

**Pre-launch Evolution:** this is a **replace** of the public hostname target, not a dual-serve / dual-write / dual-read migration. No shims that keep legacy and rebuild coherent. Rebuild volume data is **disposable / greenfield**; legacy DB and object bytes on `zoen` volumes are **not** migrated by this runbook.

**Never** `fly apps destroy zoen` from this runbook. Stop/scale legacy only after the new hostname passes `/ready`.

## Inventory snapshot

See `ops/fly/evidence/inventory-20260907T120253Z.md` (refreshed at cutover prep).

| Role | App | Host | Health (prep) | shared v4 | dedicated v6 |
| --- | --- | --- | --- | --- | --- |
| Cutover target | `zoen-rebuild` | `zoen-rebuild.fly.dev` | Fly check **passing** `{"status":"ready"}` | `66.241.124.12` | `2a09:8280:1::185:b83f:0` |
| Legacy (keep) | `zoen` | `zoen.fly.dev` + cert `zoen.tironi.xyz` | Fly check **critical** (`connection refused`) | `66.241.124.90` | `2a09:8280:1::17b:f3db:0` |

DNS for `tironi.xyz` is on **Cloudflare** (`emely.ns.cloudflare.com`, `harlan.ns.cloudflare.com`). Operator CLI: Fly authenticated; **Cloudflare / wrangler not authenticated** → DNS flip needs Enzo dashboard (or `wrangler login` + API token).

## What does NOT migrate automatically

| Asset | Legacy `zoen` | Rebuild `zoen-rebuild` |
| --- | --- | --- |
| Postgres | On volume `zoen_data` (and recovery vol) of app `zoen` | Separate volume `zoen_data` on `zoen-rebuild` — **empty/new Worlds only** |
| Object store | MinIO loopback on legacy volume | RustFS loopback on rebuild volume — **not** a copy of legacy buckets |
| Secrets | Large product set (WhatsApp, Restate, Google, …) | Rebuild secrets only (`ZOEN_AUTH_SECRET`, S3 loopback keys, OpenCode Zen) |
| Topology | Multi-process legacy image | All-in-one (PG+RustFS+app) modular monorepo |

Treat cutover as **hostname replace onto a different product install**. Any future import of legacy history is a **separate** explicit job (not this PR).

## Prerequisites (already done in prep where noted)

1. `zoen-rebuild` deployed, `min_machines_running = 1`, Fly `/ready` check passing.
2. Public IPs on rebuild: shared v4 + dedicated v6 (allocated during prep if missing).
3. Prove HTTP 200 on rebuild `/ready` (script below). Local Mac system DNS may not resolve `*.fly.dev`; use `--resolve` or `dig @1.1.1.1`.

```bash
./ops/fly/scripts/ready-check.sh
```

## Cutover steps (forward)

### 1) Add TLS hostname on rebuild (Pending until DNS points here)

```bash
./ops/fly/scripts/certs-add-hostname.sh zoen.tironi.xyz
fly certs show zoen.tironi.xyz -a zoen-rebuild
```

Expect **Pending** while DNS still targets legacy. Leave the legacy cert on `zoen` until rebuild cert is **Issued**.

### 2) Cloudflare DNS replace (Enzo login required)

Dashboard: [Cloudflare](https://dash.cloudflare.com) → zone **tironi.xyz** → **DNS** → record(s) for `zoen`.

`wrangler` is **not** authenticated on the operator Mac; there is no `CF_API_TOKEN`. Exact clicks:

1. Log in as Enzo → select zone **tironi.xyz**.
2. Open **DNS** → **Records**.
3. Find existing `zoen` **A** (`66.241.124.90`) and **AAAA** (`2a09:8280:1::17b:f3db:0`) — or a CNAME to `zoen.fly.dev`.
4. **Edit / Replace** (do not leave legacy targets alongside rebuild):

| Type | Name   | Content (cutover)         | Proxy status              |
| ---- | ------ | ------------------------- | ------------------------- |
| A    | `zoen` | `66.241.124.12`           | **DNS only** (grey cloud) |
| AAAA | `zoen` | `2a09:8280:1::185:b83f:0` | **DNS only**              |

Alternative single CNAME (instead of A+AAAA): `zoen` → `z32mowp.zoen-rebuild.fly.dev` (Fly-issued target from `fly certs setup`).

5. **Optional before traffic flip** (cert without moving users yet): add ACME challenge CNAME:
   - Name: `_acme-challenge.zoen`
   - Target: `zoen.tironi.xyz.z32mowp.flydns.net.`
6. If Cloudflare proxy (orange cloud) must stay on, also add ownership TXT:
   - Name: `_fly-ownership.zoen`
   - Content: `app-z32mowp`
7. Save. TTL Auto/300s during the window.

Do **not** keep A/AAAA pointing at legacy while also targeting rebuild.

### 3) Wait for cert Issued + health on custom hostname

```bash
fly certs show zoen.tironi.xyz -a zoen-rebuild
./ops/fly/scripts/ready-check.sh https://zoen.tironi.xyz/ready
```

Pass criteria: cert **Issued**; `GET /ready` → `200` and body `{"status":"ready"}`.

### 4) Replace public URL config (single value — no dual URL)

After hostname health passes, point the app’s public URL at the custom hostname (**replace** `ZOEN_PUBLIC_URL`, do not keep both):

```bash
# In ops/fly/fly.toml set:
#   ZOEN_PUBLIC_URL = "https://zoen.tironi.xyz"
fly deploy -a zoen-rebuild --config ops/fly/fly.toml
./ops/fly/scripts/ready-check.sh https://zoen.tironi.xyz/ready
```

### 5) Stop legacy machines only after step 3–4 pass (optional; reversible)

```bash
./ops/fly/scripts/scale-stop-legacy.sh
```

This scales `zoen` to **0** machines. It does **not** destroy the app, volumes, IPs, or certs.

### 6) Do not destroy legacy

Keep `zoen` app + volumes until an explicit later decision. Recovery volume `zoen_data_recovery_20260902` stays untouched.

## Rollback (reverse DNS; keep rebuild)

Rollback is **DNS replace back to legacy IPs** (and restore legacy scale if stopped). It does **not** copy rebuild data into legacy.

1. If legacy was scaled to 0: `fly scale count 1 -a zoen` and wait for machine start (legacy `/ready` may still be critical — known pre-cutover state).
2. Cloudflare DNS **replace** back:

| Type | Name   | Value (rollback)          |
| ---- | ------ | ------------------------- |
| A    | `zoen` | `66.241.124.90`           |
| AAAA | `zoen` | `2a09:8280:1::17b:f3db:0` |

3. Confirm `dig @1.1.1.1 zoen.tironi.xyz A/AAAA` shows legacy IPs.
4. Leave rebuild cert in place or remove later; legacy cert should still be Issued if not deleted.
5. If `ZOEN_PUBLIC_URL` was flipped on rebuild, optionally set it back to `https://zoen-rebuild.fly.dev` on the rebuild app only (does not affect legacy).

## Explicit non-goals

- No dual-write between legacy Postgres/MinIO and rebuild PG/RustFS.
- No dual-read compatibility layer or “serve both apps behind one hostname”.
- No automatic data backfill / history import.
- No `fly apps destroy zoen`.
- No Managed Postgres / Tigris provisioning.

## Scripts

| Script | Purpose |
| --- | --- |
| `ops/fly/scripts/inventory.sh` | Re-capture status/certs/secrets(names)/DNS |
| `ops/fly/scripts/ready-check.sh` | Prove `/ready` (supports URL arg; `--resolve` fallback for rebuild fly.dev) |
| `ops/fly/scripts/certs-add-hostname.sh` | `fly certs add` on `zoen-rebuild` |
| `ops/fly/scripts/scale-stop-legacy.sh` | Scale legacy to 0 after gated confirmation env |

## Evidence

- Prep inventory: `ops/fly/evidence/inventory-20260907T120253Z.md`
- After DNS flip: append a new evidence file with `dig`, `fly certs show`, and `curl` `/ready` on `https://zoen.tironi.xyz/ready`.
