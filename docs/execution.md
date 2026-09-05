# Execução inicial de D01/D02 — três workers e root

Proposta de planejamento, 2026-09-05. Nenhum código de produto foi implementado, nenhum check de produto foi executado e nenhuma capacidade foi aceita por este documento. O [JSON](../planning/execution.json) contém allowlists, contratos consumidos, aceitação e checks planejados de cada pacote.

## Resultado escolhido

Pessoa autentica pelo fluxo real, cria um World privado, importa duas fontes autorizadas que divergem sobre a mesma obrigação/intervalo e inspeciona fonte, valor, base e estado não verificado em web e CLI. Uma correção limita-se a uma obrigação, `unknown` não escolhe vencedor e desfazer acrescenta história. Outra pessoa sem acesso não recebe dados, contagens privadas ou URLs do storage. Retry conserva identidade da operação e não duplica receipt. Nenhum registro de fonte vira comprovação de pagamento externo.

É **o primeiro incremento de D01 e D02**, não a conclusão de todo seu conteúdo. Preservar merge/split reversível de identidade, priorização/stewardship, todos os formatos e provas avançadas de recuperação no mapa das entregas. Escolher um formato inicial explícito em EX02: JSON ou CSV com regras de parsing definidas, sem prometer ambos antes da execução. Docker local não prova operação no Fly; cloud deve ser executado e medido depois.

## Fronteiras de escrita

Exatamente cinco workspaces: `apps/server`, `apps/web`, `apps/cli`, `packages/contracts`, `packages/authority`.

- `worker-1`: contratos públicos e portas privadas mínimas, commit/access, evidência/knowledge e correção.
- `worker-2`: componentes web puros e conexão web, adapter PostgreSQL e identidade real.
- `worker-3`: valores puros, adapter S3, CLI e verificação independente do core/UI; sua própria CLI recebe revisão de root ou worker-2.
- `root`: manifests, lock, CI/Ultracite/configs, entrypoints/exports de integração, composição Effect, rotas publicadas e numbering das migrações. O root conecta as peças reais; workers não editam esses arquivos por conveniência.

Workers usam GPT-6-Astra, esforço low. Cada pacote possui uma allowlist exclusiva no JSON. Globs são limites para trabalho real, não uma ordem de criar árvores vazias. O mesmo owner pode reutilizar um diretório em pacotes sucessivos; nenhum par de workers compartilha escrita. Alteração em contrato consumido exige coordenação e revisão, não modificação lateral pelo consumidor.

Contratos privados de storage/presença ficam privadas em `packages/authority/src/ports/d01`; `packages/contracts` publica Schema/HttpApi e resultados transportáveis. Identity e adapters ficam privados em `apps/server`. Nenhum cliente recebe credencial de SQL/S3 ou um import capaz de furar a fronteira.

Worker-2 escreve **SQL candidato sem numbering** em `apps/server/sql/proposals/d01`. Pode aplicá-lo em namespace descartável para testar o adapter real; apenas root o publica como migração numerada em EX10. Esta distinção evita bloquear o teste SQL antes da composição e preserva dono único do histórico de migrações.

## Dependências e contratos

`depends_on.hard` significa que um contrato/artefato precisa estar estável para começar sua implementação consumidora. `optional` significa contribuição útil que não bloqueia trabalho independente. `acceptance_requires` permite preparar o componente antes da integração, mas proíbe declarar o pacote concluído sem o consumidor/serviço real correspondente. Não são dependências fictícias dispensáveis de teste: integram o grafo de conclusão, validado sem ciclos.

EX02 fixa somente:

1. World/realm, identidade verificada no servidor, finalidade e revisão de acesso.
2. Envelope versionado, identidade da operação, digest de intenção e base/guards.
3. Referência opaca de evidência, fonte/namespace/revisão, digest dos bytes, coordenada do registro, sujeito/predicado/intervalo e decimal textual.
4. Frame com base/proveniência e eixos de seleção/disputa/verificação separados; erros tipados e `unknown` explícito.
5. CreateWorld, importação limitada, Inspect e correção/unknown/undo reservados para seus handlers reais.
6. Serviços SQL do Effect e portas privadas mínimas de bytes/presença.

Esses são inputs semânticos concretos, não nomes alegadamente existentes em uma biblioteca. EX01/EX02 confirmam a API instalada de Effect 4 Schema/HttpApi e EX09 confirma o mecanismo de identidade suportado. API ausente vira bloqueio concreto; não recebe um stub “compatível”. Operação no contrato não vira rota pública antes do handler real EX10/EX14.

## Os 15 pacotes

| ID | Dono | Trabalho e resultado de aceitação | Hard para começar | Integrações adicionais para aceitar |
|---|---|---|---|---|
| EX01 | root | Toolchain real, cinco workspaces, TS7 único, Ultracite zero diagnósticos+CI, PostgreSQL/S3 Docker; probes executam transação e round-trip de bytes reais. | — | — |
| EX02 | W1 | Schemas/HttpApi mínimos e portas privadas; rejeição de envelope inválido e nenhum principal fornecido pelo cliente vira autoridade. | — | EX01 |
| EX03 | W2 | UI pura: vazio/upload/divergência/denied/unavailable, teclado e zoom; nenhum fetch ou login fake. | — | EX01 |
| EX04 | W3 | Decimal/units/tempo/IDs e canonicalização consumidos: 0.10+0.20=0.30 BRL, moeda incompatível não comparável e intervalos adjacentes sem sobreposição. | EX02 | — |
| EX05 | W1 | Executor único e commit/access/genesis/idempotência em uma primitiva; retry não duplica, digest diferente conflita, replay revogado não divulga. | EX02 | EX01, EX06 |
| EX06 | W2 | PostgreSQL real, SQL candidato, roles e constraints; runtime sem DDL, snapshot coerente e transação sem parcial. | EX02 | EX01 |
| EX07 | W3 | Storage real: upload limitado e hash; incompleto não vira evidência, erro não vaza credenciais/chave S3. | EX02 | EX01 |
| EX08 | W1 | Admissão, comparação e Inspect: duas fontes preservadas, duplicata idempotente, Frame coerente e nunca Settlement inventado. | EX02, EX04, EX05 | EX06, EX07 |
| EX09 | W2 | Identity/session reais; expiração/logout/forged actor rejeitados; presença não concede membership. | EX02, EX06 | EX01, EX05 |
| EX10 | root | Primeira composição: migrações numeradas, layers reais e handlers publicados; autenticar/criar/importar/Inspect/retry após restart. | EX01, EX02, EX04–EX09 | — |
| EX11 | W3 | Processo CLI sobre API pública: mesmo resultado/base, exit code de erro; sem credencial SQL/S3. | EX02 | EX09, EX10 |
| EX12 | W2 | Web real com upload/evidência/logout; duas sessões não compartilham conteúdo e `back` não reabre dados privados. | EX02, EX03 | EX09, EX10 |
| EX13 | W1 | Correção limitada/unknown/undo append-only; cut antigo preservado e guard alterado dá Stale sem consentimento recalculado. | EX02, EX04, EX05, EX08 | EX06, EX07 |
| EX14 | root | Registrar correção nas mesmas superfícies, preservando operationId e handler; web→CLI não duplica decisão. | EX10–EX13 | — |
| EX15 | W3 + revisão cruzada | Verificação independente navegador/CLI/SQL/S3, negativas de privacidade, corte/histórico, retry e processo morto; resultado honesto por cenário. | EX10, EX11, EX12, EX14 | — |

EX04 é informação opcional para EX05: commit pode trabalhar com contrato de digest/IDs antes de toda aritmética estar pronta. EX05 e EX06 não formam ciclo: ambos consomem os contratos estáveis EX02; EX05 só encerra sua integração após o adapter real EX06. DDL candidato no teste EX06 permite isso antes de EX10.

## Execução sugerida

**Onda A:** root prepara EX01; W1 fixa EX02; W2 faz EX03; W3 prepara casos matemáticos concretos de EX04 e contraprovas de limites a partir dos inputs acima. W3 não implementa uma cópia provisória do schema para ocupar o tempo. Quando EX02 estiver aceito, W3 inicia EX04. Não é obrigatório ter três implementações de domínio antes do primeiro contrato.

**Onda B:** W1 faz EX05; W2 faz EX06; W3 conclui EX04 e implementa EX07. Root revisa contratos, instalação e impedimentos reais e conecta somente configs/exports necessários.

**Onda C:** W1 implementa EX08; W2 implementa EX09; W3 prepara parser/formatter/entrada de EX11. A CLI só termina quando puder usar o servidor real. Dado visual ou função pura pode usar input sintético; isso não simula resposta de serviço.

**Onda D:** root compõe EX10. W1 trabalha EX13 sobre conhecimento/commit reais; W2 prepara EX12 e completa integração após EX10; W3 completa EX11 contra EX10. Workers não editam simultaneamente as migrações/entrypoints para acelerar a composição.

**Onda E:** root integra EX14. W3 executa EX15 e devolve falhas reproduzíveis aos donos. W2 ou root revisa a CLI de W3; W3 revisa core de W1 e UI/identity de W2. Root confere CI e evidência. Não existe autoaprovação de pacote crítico.

Onda não é uma barreira global: um worker começa seu próximo pacote assim que seus contratos reais estiverem estáveis e seus paths livres. Root despacha no máximo três workers; não multiplica subtarefas vazias nem gera recortes detalhados de D15–D22.

## Provas diretas e critérios de parada

O JSON traz checks específicos por pacote. A estratégia evita uma tripla artificial de checks por ticket antigo:

- Valores/normalização/classificação de resposta são testados diretamente, com limites e contraprovas, sem serviço mock.
- PostgreSQL e S3 são serviços reais do Docker; namespace, identities e registros de teste sintéticos são permitidos. Probes só removem os próprios objetos de teste.
- Browser e CLI usam o servidor real, sem `route.fulfill`, fetch interceptado para sucesso ou identidade privilegiada de desenvolvimento.
- Crash é processo morto em barreira local da transação, com inspeção independente do SQL. Não usar log “success” como prova de atomicidade e não expor barreira de teste em rota de produção.
- O mesmo operationId atravessa clientes; uma segunda proposta com guard alterado produz Stale sem “recalcular aprovação”.
- Compilação TS7 e Ultracite zero diagnósticos entram desde EX01 e continuam exigidos; integração, navegador e segurança conservam seus significados próprios.
- Nenhum efeito externo ocorre nesta primeira jornada. Assim, nenhuma afirmação de entrega/settlement é autorizada; testes verificam a ausência desse rótulo indevido.

Dependência real ausente, API não suportada, erro de permissão do provider ou incompatibilidade do toolchain bloqueiam o pacote afetado. Workers continuam apenas trabalho independente que não usa a interface faltante. Nunca preencher com fake API, fallback offline, teste vazio, `skip` ou certificado inventado.

Não declarar D01 completo enquanto seus demais formatos/recuperação/retention e critérios não tiverem prova. Não declarar D02 completo enquanto merge/split e stewardship/closure previstos estiverem pendentes. O incremento fechado aqui é a primeira jornada privada e a correção limitada com histórico. O objetivo é entregar esse comportamento real sem reconstruir um framework de admissão antes dele.

## Regras consolidadas de operação

O JSON consolidado prevalece sobre a proposta inicial dos agentes: `owns` é a allowlist, `integrator_owned_paths` reserva composição/configuração, EX05 inclui o executor comum e EX03 exige EX01 para aceitação. PostgreSQL usa SqlClient/driver Effect diretamente; não construir uma segunda interface transacional genérica. A árvore definitiva e os requisitos de CI estão em [architecture.md](architecture.md) e [quality.md](quality.md).

Cada pacote inicia em uma worktree isolada do último commit integrado. Workers não encadeiam PR sobre PR indefinidamente nem compartilham node_modules. O orquestrador recebe commits pequenos, aplica no branch de integração, revisa mudanças de contrato/migração e reroda o conjunto exigido no commit combinado. Abrir um PR por incremento verificável; não recriar a pilha antiga. Criação/publicação remota ocorrerá na fase de implementação correspondente.

`planned_commands` especifica a interface a criar, ainda indisponível neste branch de planejamento. O bootstrap deve ligar filtros a suites reais e reprovar seleção vazia; EXxx não é nome de teste automaticamente existente. A aplicação inteira continua passando qualidade/typecheck mesmo quando a prova funcional é focada.

Ao despachar: transmitir resultado, contratos exatos, owns, dependências realmente concluídas, checks e revisor. O worker reporta commit, arquivos, comando/saída e bloqueios. Quem escreveu uma peça não a aprova: W3 revisa core/UI/composição; W2 revisa CLI/storage/valores de W3 e as testemunhas de EX15. Root coordena; sua configuração de modelo não é alterada por este plano. Só os workers são explicitamente configurados como GPT-6-Astra low.

## Handoffs que precedem a aceitação

EX02 entrega `docs/contracts/d01.md` com tabelas/colunas/chaves/tipos mínimos, read set, locks, roles e política de dados. O integrador e os consumidores revisam esse contrato antes de EX05 escrever queries e EX06 produzir DDL candidato. Não criar uma interface transacional genérica: usar SqlClient e o driver Effect reais. Alteração de contrato coordena apenas os consumidores afetados.

EX11/EX12 têm um subpasso explícito de integração pelo root, registrado em `integrator_steps`: após o worker entregar exports reais em estado `implemented_unverified`, root conecta os respectivos entrypoints e ambos executam o cliente contra EX10. Isso ocorre antes da aceitação de EX11/EX12 e não espera EX14. Assim, a composição reservada não cria um ciclo de dependências escondido.

EX02 especifica a política resolvida no servidor; EX08 recusa captura incompatível antes da admissão. Dados que exigem apagamento/restore/hold ainda não suportado não entram por uma opção declarada pelo cliente. Pins/GC são exercitados desde o primeiro upload; C062/C064 continuam pendentes até D03.
