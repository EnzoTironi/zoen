# ZA-20 acceptance seam — durable grounded text profile

**Profile:** `eve-opencode-zen-v1` / `opencode-zen`

Automated proofs for this ticket live in:

- Unit: `packages/ontology/test/ports/eve/text-profile.ZA20.test.ts`
- Composition: `apps/server/test/composition/eve/text-profile.ZA20.test.ts`
- Integration (PG + mock provider): `apps/server/test/composition/eve/text-profile.ZA20.integration.test.ts`

Browser/CLI Playwright acceptance against a live OpenCode key remains optional and requires:

1. Merged ZA-19 evidence grounding (`#107`) for Known citations / Inspect parity
2. `ZOEN_OPENCODE_API_KEY` in env or `.local/opencode.env` (never commit)
3. Local disposable PG + server process

Do not claim D05 activated from profile acceptance alone.
