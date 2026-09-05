# Qualidade e CI desde o primeiro código

Este documento define os checks exigidos durante a implementação. Os scripts de qualidade, unidade, integração de infraestrutura e componentes web já existem; a [evidência do bootstrap](verification/bootstrap.md) registra seu escopo. Requisitos não são aprovados por existir no plano.

## Stack e comandos

Node 24, pnpm workspaces com um lock real, TypeScript 7, Effect 4 e Ultracite. O integrador escolhe versões compatíveis verificando os pacotes e executáveis reais; não preenche um suposto certificado ou hash por conveniência. Instalação `--frozen-lockfile` em CI. Revisões de dependências e mudanças de lock têm um dono por integração.

Interface de scripts a criar no bootstrap e completar conforme as primeiras suites forem implementadas:

| Comando planejado | O que deve executar |
| --- | --- |
| `pnpm format:check` | Oxfmt com preset Ultracite; todos os arquivos suportados pertinentes |
| `pnpm lint` | Oxlint com presets Ultracite, type-aware, type-check e avisos como erro |
| `pnpm typecheck` | Compilador TS7 real, strict, cobrindo todas as fontes e testes TS/TSX |
| `pnpm test:unit` | Leis e módulos reais; falha se a seleção esperada estiver vazia |
| `pnpm test:integration` | PostgreSQL/S3 reais, migrations, credenciais equivalentes às de produção |
| `pnpm test:acceptance` | Playwright e CLI contra servidor real da revisão integrada |
| `pnpm build` | Aplicações realmente importadas e executáveis |
| `pnpm test:container` | Construir/subir imagem e provar a jornada mínima configurada |

Scripts ainda sem suite não podem retornar verde por imprimir uma mensagem ou usar `--passWithNoTests`. Durante o bootstrap, a CI declara claramente quais provas existem. A entrega D01 só termina quando seu conjunto completo acima existe e passa. Os comandos de cada pacote em `execution.json` são alvos de implementação, não alegações de disponibilidade atual.

Ultracite inclui configuração real de Oxlint e Oxfmt. Ativar análise de tipos, type-check e `denyWarnings`; reprovar supressões não usadas. Usar o preset Effect/TS7 correspondente se compatível com as versões instaladas. Zero erros e zero avisos sobre o escopo completo; não whitelist de `runtime-sources`, silenciamento em massa ou exclusão de código difícil para fabricar verde. Arquivos gerados, dependências, binários e snapshots históricos têm tratamento explícito pela sua natureza, nunca para esconder fonte executada.

## Jobs e evidências

1. **Qualidade:** instalação congelada, format, lint, typecheck e fronteiras de import. Garantir que web/CLI não alcancem authority, SQL ou segredos por reexports/import dinâmico. Verificar o bundle e o caminho real quando necessário; lint sozinho não prova contenção.
2. **Unidade:** dinheiro/decimais, tempo, canonicalização, comparação, guardas e projeções puras. Dados sintéticos exercitam a função real. Não exigir três testes iguais por ticket.
3. **Integração:** PostgreSQL e S3 Docker isolados por execução; migração do zero e upgrade, constraints e roles, concorrência, idempotência, read set/range guard, staging/publicação e recuperação. Criar/remover somente dados e volumes efêmeros dessa execução. Sem reset de base do usuário.
4. **Jornada:** login real, World, dois arquivos, divergência explicada, evidência, correção/undo e equivalência CLI. Duas identidades verificam isolamento; logout/revogação bloqueiam replay. O backend não é mockado.
5. **Artefato:** builds reais e smoke da imagem. Guardar commit integrado, lock, perfil, comandos, resultados e logs sanitizados nos artefatos usuais da CI. Scan de segredos/dependências/imagem integra o fluxo de publicação.

Uma agregação obrigatória da CI verifica todos os jobs exigidos e reprova cancelamento, falha ou `skipped` indevido. Não depende de extrair exatamente um ticket do título do PR. Branch protection será configurada quando o fluxo novo for publicado; criar YAML local não configura proteção remota.

Integração, navegador, migração, caos e admissão rodam novamente no commit combinado a integrar, sem reutilizar resultado cacheado de outro estado ou perfil. Cache de download de dependências é aceitável; não é cache da prova. Uma falha antiga permanece registrada junto da correção, sem alterar o resultado esperado para acomodar o código.

## Testemunhas mínimas por comportamento

| Invariante | Testemunha necessária |
| --- | --- |
| Um commit semântico | Concorrência real e falha entre gravações; estado/receipt/outbox não ficam parciais |
| Retry não duplica | Mesma operação concorrente, reinício e reenvio; digest diferente rejeitado |
| Direitos atuais | Outra identidade, grant insuficiente, revogação antes de emissão/replay/download |
| Não interferência | Dois estados que diferem apenas em conteúdo oculto; comparar payload e metadados observáveis |
| Retenção honesta | Queda no staging e publicação; órfão não vira evidência; fonte ausente não vira cobertura completa |
| Correção governada | Base obsoleta rejeita; undo cria evento compensatório e preserva leitura histórica |
| Apagamento e restore | Supressão persiste fora do rollback relevante e impede reaparecimento após restore |
| Efeito externo | Provider real, interrupção após envio, reconciliação de Unknown sem repetição cega |
| Extensão isolada | Artefato adversário no runner real, limites externos e revogação observada |

Cada testemunha entra com a capacidade correspondente. Provar um subconjunto não aprova todo o produto. `@effect/vitest`, TestClock e controle de fibers auxiliam testes da camada apropriada; não substituem Postgres, storage, autenticação, relógio de commit ou provider reais.

## Ativação e revisão

Caos, carga, restore, licenças, SSO, feeds, brokers, modelos e runtimes externos têm perfil, versão e escopo explícitos. A ausência de uma conta bloqueia sua ativação; não transforma a CI em prova daquele provider e não bloqueia uma entrega independente. Não inventar SLO, benchmark, API ou licença para preencher uma planilha.

O autor escreve testes de módulo e reproduz a falha. Outro agente revisa intenção, fronteiras e testemunha independente; o integrador resolve conflitos e reroda a composição. Revisar documentação não aprova código futuro. Entrega que exige produção/conta externa mantém esse gate separado do resultado local.
