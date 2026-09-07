# Releasing

There is no published versioned release yet. `main` is the supported line. Production deploys from `main` once continuous deploy lands (see open CD work for Fly app `zoen-rebuild` → [https://zoen.tironi.xyz](https://zoen.tironi.xyz)).

## First GitHub Release

When you are ready for a named artifact:

1. Ensure Verify’s `required` job is green on the commit you intend to tag.
2. Tag from that commit: `git tag v0.1.0 <sha> && git push origin v0.1.0`.
3. Create a GitHub Release from the tag (UI or `gh release create v0.1.0 --generate-notes`). Attach container image digests or build outputs only if they were produced by CI for that SHA — do not invent assets.

Prefer documenting the process here over half-wired release automation until CD on `main` is stable. A future `release` workflow can mirror that tag → notes path; do not add a broken stub.

## What not to ship

- Fly secrets, tokens, or local `.env*` profiles
- Disposable proof logs under `.local/`
- Historical zip archives kept outside git (`~/Zoen-local/`)
