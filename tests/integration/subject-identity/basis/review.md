# EX25 BC-01..09 — notas para contraprova (worker-3)

Escopo candidato a refutar, não a reexecutar mecanicamente.

## O que a suíte afirma ter visto

- Histórico real do executável `06535bd` em PostgreSQL/S3, depois migração 007 e `SemanticExecutor` atual como **componente** na mesma instalação/Presence.
- BC-01..05: payloads/digests legados, replay, Conflict/terceiro/logout, Stale de ato novo.
- BC-06: base v2 completa; Propose ajusta só `cases`; bump SQL de `authority.domains.identity` → Answer `Stale`.
- BC-07: replay bootstrap/import/grant/revoke; novos writes `basis:null` com `touched_domains.identity`.
- BC-08: rollback de 007 com falha injetada; CHECK parcial sem linha identity → `readCut` Unavailable; recovery via migrator.
- BC-09: emissão literal pós-transição; revoke bloqueia `executeWithEmission`.

## Lacunas honestas (não fingir verde)

1. **BC-06 aresta redundante/ausência:** não há writer EX27. O teste avança o cut por SQL. Refutar se isso não equivaler semanticamente a um writer que só registra ausência/redundância.

Update 2026-09-06: EX27 vertical slice writers exist (`handlers.EX27`); core proves Resolve Stale after identity bump and recovery undo. Full redundant-edge/phantom oracles still open under independent/.
2. **BC-09 Web/CLI identidade:** EX28. Aqui só o caminho de executor+fence já usado por HTTP D01/sharing. Refutar se a obrigação EX25 exigir superfície Web/CLI de identidade antes do verified.
3. **Fence concorrente SH07/08:** não reexecutado nesta suíte após a transição; herda EX23. Refutar se a adição do domínio identity alterar locks/pending.
4. **Upgrade de instalação:** explicitamente fora de escopo; release digest permanece o do legado.

## Comandos

```bash
ZOEN_TEST_LEGACY_ROOT=/Users/enzotironi/zoen-rebuild/.local/identity-baseline-20260905-2203/source \
  node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration \
  tests/integration/subject-identity/basis/
```
