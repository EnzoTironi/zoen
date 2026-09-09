# Eve durable grounded text profile — ZA-20

Data: 2026-09-08 (PT). Perfil produto texto: `eve-opencode-zen-v1` / admission `opencode-zen`.

## Escopo verificado

| Item | Estado |
| --- | --- |
| Qualificação estreita do perfil texto grounded | Landed — `packages/ontology/src/ports/eve/text-profile.ts` |
| `textProfileAccepted` na admissão de produto | Landed — `admission.ts` + `composition.ts` |
| Journal durável (ZA-18) + settle/replay | Provas em `text-profile.ZA20.integration.test.ts` |
| Evidência/Known autorizado (ZA-19) | Landed (#107) — composition sets `evidenceGroundingQualified: true`; tip keeps `textProfileAccepted: false` without G-PROVIDER |
| G-PROVIDER (OpenCode Zen live) | Key só em env/Fly secrets — nunca commit; ausência → Blocked |
| D05 integral / voz cloud / multi-provider | **Não** alegado |

## Acceptance

| ID | Resultado |
| --- | --- |
| ZA-20-01 | Settle com evidence links + restart do journal → uma mensagem visível; replay do mesmo ingress não duplica |
| ZA-20-02 | Key/perfil/suite ausentes → `textProfileAccepted`/readiness false; Zen permanece Blocked |
| ZA-20-03 | Provider perdido → turn Cancelled, zero Visible fabricado; retry explícito → no máximo um settlement |

## Fail-closed

- Key OpenCode sozinha **não** admite produto (ZA-17).
- Tip mantém `textProfileAccepted: false` sem prova G-PROVIDER live — harness/tests podem optar explicitamente.
- Quando todos os gates forem true (journal + grounding + textProfileAccepted + key), composition instala `liveModelPortLayer` — nunca stubMemory.

## Comandos

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run --project unit \
  packages/ontology/test/ports/eve/text-profile.ZA20.test.ts \
  packages/ontology/test/ports/eve/admission.ZA17.test.ts
pnpm exec vitest run --project unit \
  apps/server/test/composition/eve/text-profile.ZA20.test.ts
# Requer ZOEN_TEST_DATABASE_URL (G-RESOURCES):
pnpm exec vitest run --project integration \
  apps/server/test/composition/eve/text-profile.ZA20.integration.test.ts
```

Operator one-command (fail-closed sem key): `pnpm eve:qualify-gprovider` — ver `docs/ops/eve-gprovider-operator-runbook.md`.

Live OpenCode (opcional; skip/Blocked sem key):

```bash
set -a; source .local/opencode.env; set +a
pnpm exec vitest run --project integration \
  packages/ontology/test/ports/eve/opencode-zen.EX43.integration.test.ts
```

## Não alegado

- Full D05 / ZN-0281
- Cloud STT/TTS
- Exactly-once billing sob incerteza do provider
- Product Eve activated só porque este PR mergeou
