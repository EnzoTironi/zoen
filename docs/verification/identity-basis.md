# Identidade — preparação da prova de compatibilidade

A compatibilidade EX25 ainda não está marcada como `verified_for_profile`: falta a revisão independente. Em 2026-09-05 foi preparado e compilado o executável anterior real que produz o histórico pré-transição. Em 2026-09-06 a suíte de componente sob `tests/integration/subject-identity/basis/` exercitou BC-01–09 sobre esse histórico e a migração 007.

## Executável anterior isolado

`python3 tooling/prepare_identity_baseline.py --out .local/identity-baseline-01` extrai o commit fixo `06535bdcec668f62ba6d91d8ebb17e0235ed568b` por `git archive`, instala seu próprio lock e patches e executa seu próprio build. Se o objeto não existe no checkout raso da CI, busca somente esse SHA no origin. O comando exige Node 24, pnpm 11.25.0 e um diretório novo; não sobrescreve tentativas ou evidências anteriores. Logs e fontes ficam retidos mesmo em caso de falha.

O processo não copia `node_modules`, builds, aliases, ambientes, bancos ou configurações do checkout atual. `ZOEN_*`, `NODE_PATH` e `NODE_OPTIONS` são removidos do ambiente dos subprocessos de instalação/build. Nenhum serviço é iniciado, provisionado ou migrado. O record final identifica os bytes realmente observados e verifica cada arquivo listado no manifesto compilado.

Execução local concluída por root com Node `v24.20.0` e pnpm `11.25.0`:

| Artefato | Evidência observada |
| --- | --- |
| Diretório | `.local/identity-baseline-20260905-2203/` |
| Archive das fontes | SHA-256 `249d42ac72b8ccb024dd024de1d9587778468489b7be4a0935f9bc24da9e5057` |
| Lock original | SHA-256 `4a1e52e279acf04ec99003d82b806342d6048ef5af7ee87b2e2543968b47028a` |
| Manifesto do build | SHA-256 `f680f198334537bccc0f4b39b1cd55cb28eb9b73fd091506682e2b5bae799537` |
| Verificação do manifesto | 97 arquivos correspondem aos hashes retidos |
| Registro e logs | `build-proof.json`, `install.log`, `build.log` |

O manifesto resultante coincide com o build anterior `767f757` observado no perfil de compartilhamento. O nome do diretório é um identificador da tentativa, não um carimbo de início. Uma segunda chamada com o mesmo destino retornou erro antes de sobrescrever arquivos. Esta é prova do preparador, ainda não de BC-01.

## Fronteiras da transição

A migração 007 é uma extensão explícita de 001–006. Ela bloqueia as tabelas de Worlds/domínios durante a transação, admite o novo nome de domínio e registra identidade inicialmente vazia para cada World existente. Não modifica as bases salvas, receipts, Frames, Cases, eventos ou vínculos de instalação dos Worlds. O executor anterior precisa estar parado antes dessa transição; seu reader de cinco domínios não é compatível com o estado novo.

O futuro harness usa HTTP/Better Auth/PostgreSQL/S3 reais do executável anterior para produzir o histórico. Após parar esse processo e aplicar a transição no banco exclusivo da prova, o executor atual é exercitado como **componente**, com a instalação original observada e Presence do provider real. Ele não chama a admissão de startup do servidor novo e não altera o release ligado ao World. Portanto essa prova não pode ser apresentada como upgrade de uma instalação. Admissão, HTTP e navegador do executável novo exigem perfil novo independente.

## Provas executadas (EX25, componente)

Em 2026-09-06, no checkout `codex/rebuild`, as suítes sob `tests/integration/subject-identity/basis/` produziram histórico real com o executável isolado `06535bd`, aplicaram a migração 007 (ou falhas controladas dela) e exercitaram o `SemanticExecutor` atual como componente.

Comando típico:

```bash
ZOEN_TEST_LEGACY_ROOT=.../identity-baseline-20260905-2203/source \
  node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration \
  tests/integration/subject-identity/basis/
```

| Oráculo | Resultado observado |
| --- | --- |
| BC-01 | Passou: World, imports JSON/CSV, Frame, proposta pendente, correção aplicada, undo e receipts com bases legadas sem `schemaVersion`/identity |
| BC-02 | Passou: `Inspect` com `atFrame` devolveu o payload visível retido byte-a-byte após a transição |
| BC-03 | Passou: replay exacto de Propose/Answer/Undo legados devolveu os receipts originais |
| BC-04 | Passou: mesmo opID com intenção diferente → Conflict; terceiro → NotFoundOrDenied; logout → Unauthenticated |
| BC-05 | Passou: novos opIDs sobre base/Question legada → Stale sem novos cases/receipts/corrections/outbox |
| BC-06 | Passou: inspeção nova emite `authority.basis.v2` com cut de seis domínios; Propose/Answer ajustam só `cases`; avanço concorrente de `identity` deixa Case literal `Stale`. EX27 vertical slice: writer ResolveIdentity avança `identity`; Resolve de Case retido fica `Stale` após bump de `identity` (handlers.EX27). Aresta redundante / phantom full suite ainda parcial |
| BC-07 | Passou: replay de CreatePersonalWorld/ImportEvidence/Grant/Revoke legados preserva receipts; novos writes `basis:null` gravam cut/receipt com `identity` sem Frame |
| BC-08 | Passou: falha injetada no meio do SQL 007 faz rollback sem registrar migração 7; CHECK parcial sem linha `identity` deixa `readCut` em Unavailable preservando worlds/evidence/receipts; `applyIdentityBasisMigrations` recupera |
| BC-09 | Passou (componente): `executeWithEmission` emite DTO literal `FrameInspected` após a transição; revogação vencedora impede emissão (`NotFoundOrDenied`, emit não chamado). UI Web/CLI de identidade é EX28 e permanece bloqueada; ordenações concorrentes SH07/08 do fence continuam evidência EX23 |

O pacote EX25 permanece **não** marcado como `verified_for_profile`: falta a revisão independente (worker-3). O contrato completo está em [d02-basis-compatibility.md](../contracts/d02-basis-compatibility.md).

## Contraprovas independentes (EX26, worker-3)

Em 2026-09-06, sob `tests/integration/subject-identity/independent/`, a revisão independente exercitou ângulos distintos da suíte de autoria EX25:

| Oráculo independente | Resultado |
| --- | --- |
| Multi-world 007 + digest legado corrompido | Passou: dois Worlds pré-transição; frames/receipts byte-iguais; migrator idempotente; digest legado errado → `Unavailable`; digest v2 errado → `Stale` |
| Audiência com grant pré-transição | Passou: Frame do viewer congelado; emissão sem `authority.basis.v2`/grafo; propose do viewer negado; revoke bloqueia emissão |
| Concorrência Answer×identity / Answer×Import | Passou: sem apply parcial; outcomes `applied` ou `Stale` coerentes com cuts |
| SIGKILL em transação 007 aberta | Passou: snapshot inalterado; CHECK parcial → `Unavailable`; recovery pelo migrator |

Comando:

```bash
ZOEN_TEST_LEGACY_ROOT=.../identity-baseline-20260905-2203/source \
  node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration \
  --no-file-parallelism tests/integration/subject-identity/independent/
```

Lacunas restantes para EX26 completo: suite completa grafo/ausência/recuperação (EX27 avançou: ProposeIdentitySplit real + provas core/independent de split/Stale; ID-08/13 completos e limites de Question de recuperação ainda parciais), Web/CLI de identidade (EX28). EX25 componente BC-01..09 permanece coberto; `verified_for_profile` ainda exige essas lacunas honestas.
