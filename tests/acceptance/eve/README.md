# Eve acceptance seams

## ZA-20 — durable grounded text profile

**Profile:** `eve-opencode-zen-v1` / `opencode-zen`

Automated proofs:

- Unit: `packages/ontology/test/ports/eve/text-profile.ZA20.test.ts`
- Composition: `apps/server/test/composition/eve/text-profile.ZA20.test.ts`
- Integration (PG + mock provider): `apps/server/test/composition/eve/text-profile.ZA20.integration.test.ts`

Live OpenCode key remains optional (G-PROVIDER); absence stays Blocked. Do not claim D05 activated from profile acceptance alone.

## ZA-21 — browser voice I/O adapter

**I/O profile:** `eve-web-speech-v1` / `web-speech`  
**Text turn binding:** same `eve-opencode-zen-v1` / `opencode-zen` (channel change grants no authority)  
**Cloud speech:** disabled

Automated proofs (unit; fake recognition is **not** device qualification):

- `apps/web/test/features/eve/voice-session.ZA21.test.ts` — ZA-21-01/02/03 session + controls
- `apps/web/test/features/eve/browser-voice.ZA21.test.ts` — contracts + server policy
- `apps/web/test/features/eve/web-speech.EX44.test.ts` — Node fail-closed Web Speech

Manual / real-device speech matrix and Blocked status: `docs/verification/eve-web-speech.md`.

Do not claim product Eve or cloud speech activated because this PR merged.
