# Identidade — preparação da prova de compatibilidade

A compatibilidade EX25/EX26 ainda não está verificada. Em 2026-09-05 foi preparado e compilado o executável anterior real que produzirá o histórico pré-transição. Schemas e geração de artefatos não substituem esse histórico, replay autorizado, migração e os testes do executor.

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

Em 2026-09-06, no checkout `codex/rebuild`, a suíte
`tests/integration/subject-identity/basis/compatibility.EX25.integration.test.ts`
produziu histórico real com o executável isolado `06535bd`, parou esse writer,
aplicou a migração 007 no banco exclusivo da prova e exercitou o
`SemanticExecutor` atual como componente sobre a mesma instalação/Presence.

| Oráculo | Resultado observado |
| --- | --- |
| BC-01 | Passou: World, imports JSON/CSV, Frame, proposta pendente, correção aplicada, undo e receipts com bases legadas sem `schemaVersion`/identity |
| BC-02 | Passou: `Inspect` com `atFrame` devolveu o payload visível retido byte-a-byte após a transição |
| BC-03 | Passou: replay exacto de Propose/Answer/Undo legados devolveu os receipts originais |
| BC-04 | Passou: mesmo opID com intenção diferente → Conflict; terceiro → NotFoundOrDenied; logout → Unauthenticated |
| BC-05 | Passou: novos opIDs sobre base/Question legada → Stale sem novos cases/receipts/corrections/outbox |
| BC-06–09 | Ainda não executados nesta suíte |

O pacote EX25 permanece **não** marcado como `verified_for_profile`: faltam
BC-06–09 e a revisão independente. O contrato completo está em
[d02-basis-compatibility.md](../contracts/d02-basis-compatibility.md).
