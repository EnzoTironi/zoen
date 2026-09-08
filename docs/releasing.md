# Releasing

There is no published versioned release yet. `main` is the supported line. Production deploys from `main` once continuous deploy lands (see open CD work for Fly app `zoen-rebuild` → [https://zoen.tironi.xyz](https://zoen.tironi.xyz)).

## Continuous deploy admission (ZA-07)

Production target remains Fly app `zoen-rebuild` (all-in-one). Continuous deploy on `main`:

1. **Verify** builds the all-in-one image **once**, runs the hosted identity + lifecycle seams on that exact image, and uploads `exact-image-admission` (`admission.json` + seam reports). On `main` push it also publishes `ghcr.io/<owner>/zoen/all-in-one:sha-<commit>` and records the immutable registry digest.
2. **Deploy Fly** waits for Verify on the **same commit** for both `push` and `workflow_dispatch` (manual dispatch is not a Verify bypass). It downloads that run’s admission artifact, refuses cross-commit / substituted digest / missing reports, pulls the admitted digest, mirrors it to `registry.fly.io/zoen-rebuild`, and deploys with `flyctl deploy --image …@sha256:…` (no uncontrolled Dockerfile rebuild).
3. Post-deploy `/ready` is fail-closed health only — it does **not** certify which artifact was admitted.
4. Superseded Verify (`cancelled`/`skipped` from concurrency on rapid pushes) yields intentional **no-deploy** without certifying that SHA. Manual dispatch with cancelled/failed/missing Verify refuses deploy.

Local `fly deploy` against `ops/fly/fly.toml` still rebuilds from the Dockerfile and is **outside** this admission path.

## First GitHub Release

When you are ready for a named artifact:

1. Ensure Verify’s `required` job is green on the commit you intend to tag (includes `exact-image` admission for all-in-one).
2. Tag from that commit: `git tag v0.1.0 <sha> && git push origin v0.1.0`.
3. Create a GitHub Release from the tag (UI or `gh release create v0.1.0 --generate-notes`). Attach container image digests or build outputs only if they were produced by CI for that SHA — do not invent assets.

Prefer documenting the process here over half-wired release automation until CD on `main` is stable. A future `release` workflow can mirror that tag → notes path; do not add a broken stub.

## What not to ship

- Fly secrets, tokens, or local `.env*` profiles
- Disposable proof logs under `.local/`
- Historical zip archives kept outside git (`~/Zoen-local/`)
