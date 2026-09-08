# ZA-21 acceptance seam — browser voice without cloud speech

**Tip base:** origin/main @ `2a7bda6` (ZA-20).  
**Adapter:** optional Web Speech I/O over the admitted text turn.

| ID | Seam | Proof location | Outcome |
| --- | --- | --- | --- |
| ZA-21-01 | Supported path (automated state machine + text-turn shape) | `apps/web/test/features/eve/voice-session.ZA21.test.ts` | Transcript→text turn→settled speak + visible controls |
| ZA-21-02 | Unsupported / mic denied | same + Node EX44 | No hidden listener; no fabricated transcript; text usable |
| ZA-21-03 | Cancel during recognition/speech | same | Stops at boundary; no further unauthorized settle |

Real browser/device mic + audible TTS: **manual / Blocked** until operator evidence is attached in `docs/verification/eve-web-speech.md`. Replacement recognition callbacks in unit tests are not qualification.
