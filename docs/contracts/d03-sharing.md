# D03.1 — leitura compartilhada de um World e revogação

**Contrato semântico congelado por root em 2026-09-05 para EX20–EX23; implementação e aceitação pendentes.** A investigação partiu de `e81b95a` e foi confrontada com a composição CSV em `fe86850`. Os donos e gates estão em `planning/execution.json`. A ativação exige composição real, cerca de divulgação e revisão independente; este documento não é prova de acesso concedido.

O recorte proposto permite que o owner de um World existente conceda leitura a outro principal de uma conta local existente e revogue esse acesso. Usa o mesmo executor semântico, autoridade PostgreSQL, identidade Better Auth e storage S3 já compostos. Não cria convite, envio de mensagem, descoberta de usuário por email, conta automática ou integração de provider.

A entrega [D03](../../planning/deliveries.json) também exige apagamento e supressão que sobreviva a restore. Este incremento **não conclui D03**. Mantém somente `worlds-local-retained-v1`, `live`, dados admitidos não sensíveis, retenção enquanto pinned, sem apagamento, hold, expiração de licença ou restore após apagamento. Uma política que exija essas operações permanece `Blocked`; revogar acesso não remove evidência, pins, histórico ou cópias já recebidas. Sessão de app, guest e link de continuação dependem de D08 e ficam fora deste contrato.

## Base atual e mudanças indispensáveis

As leis aplicáveis estão em [invariants.md](../invariants.md), especialmente INV-01, 05–10, 19–22; as fronteiras em [architecture.md](../architecture.md) e a prova em [quality.md](../quality.md).

| Código vigente | O que ele garante e o risco ao ampliar |
| --- | --- |
| [access/world.ts](../../packages/ontology/src/access/world.ts), `AccessRow` e `authorizeWorld` | Aceitam exclusivamente `role = owner`. A função verifica presença, realm, membership ativa, emergency deny e perfil, mas não distingue a capacidade de leitura da de mutação. Aceitar `viewer` no schema, sozinho, permitiria usar handlers de escrita. |
| [001_authority.sql](../../ops/migrations/001_authority.sql), `memberships` | A chave é `(world_id, realm, principal_id)`; há estado, revisão e constraint de role owner. Genesis cria uma membership owner. A constraint atual não limita o número de owners por World. Não editar a migração aplicada. |
| [commit/mutation.ts](../../packages/ontology/src/commit/mutation.ts) e [receipt.ts](../../packages/ontology/src/commit/receipt.ts) | SERIALIZABLE, locks ordenados, identidade de operação por principal/World, reautorização, estado/receipt/outbox no mesmo commit. Resultados e intenção ainda não aceitam operações de compartilhamento. |
| [inspect.ts](../../packages/ontology/src/knowledge/worlds/inspect.ts) | Lê claims do World, grava Frame/pins e faz recheck após o snapshot. Frame histórico exige o mesmo principal, propósito e sujeito. Leitura semântica pode gravar metadados internos; não classificar permissões por verbos SQL. |
| [corrections/projection.ts](../../packages/ontology/src/knowledge/corrections/projection.ts), [frame.ts](../../packages/ontology/src/knowledge/corrections/frame.ts) e [case.ts](../../packages/ontology/src/knowledge/corrections/case.ts) | Correções, Frames e Questions continuam privados por principal. O DTO aceita apenas `authoredBy: current-principal`; não admite apresentar a correção do owner como autoria do leitor. |
| [open.ts](../../packages/ontology/src/evidence/worlds/open.ts) | Lê bytes exatos de S3, verifica digest e relê localização/autorização antes de retornar. Não entrega chave, versão S3 ou URL presigned. |
| [semantic/executor.ts](../../packages/ontology/src/semantic/executor.ts) | Verifica novamente a sessão e a membership antes de retornar o DTO. Essa checagem ainda antecede a entrega pelo transporte; não prova, sozinha, exclusão de uma corrida entre o último SELECT e o início da emissão HTTP. |
| [grants.ts](../../apps/server/sql/proposals/worlds/grants.ts) e [identity/grants.ts](../../apps/server/src/identity/worlds/grants.ts) | Os papéis SQL são de componentes. Authority não lê identity; identity não escreve authority/jobs. Viewer é papel semântico de membership, não um login SQL novo. |

## Audiência e papéis propostos

A unidade de concessão é **todo o conteúdo de evidências e claims admitidas do World**, existente e futuro, no mesmo realm e propósito `personal-records`. O owner deve ver esse alcance antes de confirmar: conceder leitura não se limita ao Frame exibido, a um arquivo ou a uma obrigação. Não oferecer escopo por fonte, campo, período ou documento neste incremento.

A concessão não inclui sessões, credenciais, lista de membros, receipts de outro autor, Questions, Frames privados ou correções privadas do owner. O leitor cria seus próprios Frames por `Inspect`; seu `scopedCorrections` permanece vazio neste recorte, pois não pode criar correções. Não substituir essa ausência por contagem, aviso ou digest que revele decisões ocultas. Comparação automática, fonte e estado não verificado continuam como em D01.

| Operação sobre o World | Owner ativo | Viewer ativo | Ausente/revogado |
| --- | --- | --- | --- |
| `Inspect`, `OpenEvidence` | Permitida | Permitida, com a audiência acima | `NotFoundOrDenied` |
| `ImportEvidence` | Permitida | Negada antes de reservar captura ou chamar S3 | Negada |
| `ProposeCorrection`, `AnswerQuestion`, `UndoCorrection` | Permitida, com autoria e guards atuais | Negada inclusive em replay | Negada |
| Inspecionar a própria membership ativa | Permitida | Permitida | Negada |
| Inspecionar um destinatário e conceder/revogar leitura | Permitida | Negada | Negada |

`CreatePersonalWorld` continua disponível para uma presença admitida, produzindo um novo World próprio. Ter acesso como viewer a outro World não interfere nisso. Nenhum cliente envia capabilities, papel SQL ou contexto verificado.

Não há promoção de viewer, co-owner, transferência de ownership, exclusão/renúncia do owner ou revogação da própria membership owner. Tentativa do owner de usá-la como alvo destas mutações é `InvalidInput`; outros atores recebem a negação uniforme antes de descobrir quem é owner. A migração precisa validar que os Worlds existentes têm um único owner e preservar essa restrição; inconsistência é bloqueio de migração, não autorização para apagar ou escolher registros.

## Identificação do destinatário

`PrincipalRef` público é um UUID opaco que identifica exatamente o principal local. Mapeia explicitamente para o `PrincipalId` interno; nunca para email, nome, cookie ou sessionId. O destinatário já passou pela autenticação real e pode copiar o seu próprio ID da resposta de sessão autenticada existente. O owner recebe esse ID fora do produto e informa-o explicitamente. O WorldRef também pode ser informado manualmente; possuí-lo não concede acesso.

Não é necessário que o destinatário mantenha uma sessão aberta enquanto o owner concede leitura. Ao ler, ele precisa de sua própria sessão válida atual. O incremento não admite exclusão/reutilização de contas como operação de produto.

**Decisão congelada de audiência:** o owner pode endereçar um `PrincipalRef` exato e observar somente se a concessão foi possível. A concessão solicitada exige essa observação mínima de elegibilidade do ID fornecido; ela não admite busca, enumeração, nome ou email. O ID vem da própria sessão autenticada do destinatário e é compartilhado fora do produto. A revisão independente deve verificar os limites dessa observação e a autorização anterior à consulta; achado incompatível bloqueia ativação. Não criar convite, token ou envio de email neste recorte.

Com essa decisão admitida, o adapter de identidade verifica somente a existência do ID exato na base Better Auth atual, usando o pool identity. Não retorna nome, email, estado de sessão, lista ou sugestões. O executor faz essa consulta apenas depois de autorizar o owner e apenas para uma concessão nova; a consulta não fica dentro do commit de autoridade. A inexistência usa `NotFoundOrDenied`, sem explicar qual predicado falhou. Revogar uma membership existente não depende de a conta ainda existir. Replay de uma concessão já registrada reautoriza o owner e lê seu receipt, sem exigir uma nova consulta de elegibilidade nem reativar acesso.

Esse adapter e sua porta estreita ainda não existem: precisam ser implementados e testados contra o schema instalado; não se assume uma API de provider não verificada. Não adicionar FK entre bases lógicas, cópia de diretório de usuários na autoridade ou grants de identity ao papel authority. Se exclusão/desativação de conta passar a existir, a corrida com elegibilidade precisa de contrato próprio antes de ativá-la.

## Operações públicas mínimas

Nomes e shapes abaixo são o contrato congelado a implementar, ainda não APIs disponíveis. Reusar `WorldRef`, `OperationId`, `Revision` decimal textual, erros fechados e parsing de bytes estrito. Proposta de família: `schemaVersion: sharing.v1`, mesmo propósito `personal-records`, transporte HTTP `POST /api/sharing/execute` e grupo tipado no mesmo `HttpApi`. Acrescentar a família ao mesmo `SemanticExecutor`; nenhuma rota executa SQL ou regras de membership diretamente.

Todas as respostas abaixo incluem `worldRef`. `Membership` contém somente `{ principalRef, role: owner | viewer, state: active | revoked, revision }`. Nenhuma resposta pública inclui cut global, security revision, principal de terceiros não solicitado ou dados do storage.

| Operação | Input | Resultado |
| --- | --- | --- |
| `InspectWorldAccess` | `{ principalRef: PrincipalRef | null }` | `WorldAccessInspected { membership: Membership | null }`. `null` no input pede a própria membership; a inexistência no resultado só é observável pelo owner ao inspecionar um alvo exato. |
| `GrantWorldReadAccess` | `{ principalRef, expectedRevision: Revision | null }`+`operationId` no envelope | `WorldReadAccessGranted { receiptRef, membershipAtCommit: Membership }`, sempre role viewer e estado active. |
| `RevokeWorldReadAccess` | `{ principalRef, expectedRevision: Revision }` + `operationId` no envelope | `WorldReadAccessRevoked { receiptRef, membershipAtCommit: Membership }`, sempre role viewer e estado revoked. |

`InspectWorldAccess` com alvo diferente do próprio principal exige owner. Viewer não pode distinguir alvo existente, inexistente ou revogado. A leitura do próprio papel serve para apresentação dos clientes; o executor continua decidindo todas as permissões. Não há enumeração de Worlds, membros ou usuários nesta etapa.

O owner obtém a revisão de alvo por `InspectWorldAccess` antes de confirmar uma mudança. `expectedRevision: null` significa ausência da membership, não revisão zero. Ausência de flag/field não assume null e não gera operationId. O cliente conserva input, alvo, revisão e operationId no retry; `Stale` exige releitura e uma nova intenção explicitamente confirmada.

### Transições e concorrência

| Estado atual do alvo | Conceder com revisão exata | Revogar com revisão exata |
| --- | --- | --- |
| Ausente | `expectedRevision: null`: inserir viewer active com revisão `0` | `NotFoundOrDenied`; não fabricar tombstone |
| Viewer active, revisão r | Manter active/r; nova operação pode registrar receipt de no-op | Trocar para revoked/r+1 |
| Viewer revoked, revisão r | Trocar para active/r+1 | Manter revoked/r; nova operação pode registrar receipt de no-op |
| Owner | `InvalidInput` para o owner autorizado | `InvalidInput` para o owner autorizado |

Em todos os casos, revisão divergente ou null incompatível com o estado é `Stale`, antes de nova gravação. No-op mantém revisão e domínio, mas tem o receipt/outbox da nova identidade de operação. A linha de membership nunca é apagada. Toda mudança efetiva incrementa **uma vez** a revisão do alvo e o domínio `membership`; a primeira inserção começa em revisão zero e também incrementa o domínio. Não incrementar revisões de claims/evidence/sources, nem alterar automaticamente `world.security_revision` ou a membership do owner.

O domínio membership existente protege a ausência e serializa concessões concorrentes para o mesmo alvo, inclusive quando ainda não há linha para bloquear. O plano de commit precisa declarar esse domínio, adquirir os locks na ordem comum, reler owner/alvo/revisão sob SERIALIZABLE e fazer a transição, operação, receipt e outbox no mesmo commit. O primeiro grant concorrente ganha; outro com identidade diferente e expectativa de ausência fica `Stale`. Mesmo operationId/intenção retorna exatamente o primeiro resultado, sem novo incremento ou outbox. O limite vigente de três tentativas totais para serialization/deadlock permanece.

`membershipAtCommit` é histórico imutável, não uma consulta ao estado atual. Replay de grant depois de revoke retorna o receipt original ao owner ainda autorizado **sem reativar a membership**. A UI/CLI não deve anunciá-lo como prova de acesso atual: consulta `InspectWorldAccess` para exibir o estado presente. Regrant exige nova operação, revisão da linha revoked e nova confirmação. A revisão não volta a zero; impede ABA de um pedido antigo.

## Autorização comum, replay e erros

A capacidade exigida deve derivar da operação semântica em código fechado. Não aceitar capacidade declarada pelo cliente nem um default permissivo. A revisão precisa cobrir todos os chamadores atuais de `authorizeWorld`, a entrada dos handlers antes de I/O e o caminho de replay dentro do commit. Alterar só a checagem final do HTTP deixaria uma mutação do viewer acontecer antes da negação.

- Presença ausente/expirada ou logout: `Unauthenticated` atual. Realm/perfil fora do admitido: os bloqueios atuais, sem ativar evaluation.
- World inacessível, papel insuficiente ou alvo não observável: `NotFoundOrDenied`, mesmo status 404 e payload fechado, sem IDs privados anexos.
- Estrutura inválida, campos excedentes, duplicate keys ou papel arbitrário: `InvalidInput` antes de negócio. Não aceitar um campo `role` livre para concessão.
- Mesma identidade de operação com intenção diferente: `Conflict`. Verificar replay após reautorizar, antes de aplicar expectedRevision ou consultar novamente elegibilidade do alvo.
- Revisão diferente da confirmada: `Stale`, sem atualizar intenção silenciosamente. Falha de infraestrutura: `Unavailable`/retryable atual; não simular sucesso.

As chaves de deduplicação continuam `(World, realm, principal, semanticOperation, operationId)`, sem transporte. HTTP, CLI e web produzem a mesma intenção canônica. Resultado da operação do owner não é replayável pelo viewer por conhecer um operationId ou receiptRef.

Mudança de membership invalida conservadoramente Questions pendentes porque `InternalBasis` inclui todo o DomainCut. Preservar esse comportamento nesta etapa: não retirar `membership` do read set para evitar `Stale`. O owner pode repropor após releitura. Viewer não recebe o cut nem infere mudanças de outros membros pela validação de uma mutação, pois não pode executar essas mutações.

## Revogação em voo e limite de emissão

A propriedade exigida é: **após o commit efetivo de revogação, uma divulgação ainda não liberada ao transporte não pode ser liberada ao destinatário revogado**. Nova leitura, Frame histórico próprio, download e qualquer retry reautorizam o principal atual. Regrant posterior é uma nova concessão explícita; volta a permitir a audiência completa, inclusive Frames históricos do próprio leitor, mas nunca transfere os Frames do owner.

Bytes já liberados/enviados não podem ser recolhidos. O cliente precisa limpar dados privados e interromper a interação ao receber negação, mas cache/UI e broadcast não constituem a prova de revogação. Não prometer invalidar arquivos que o destinatário já salvou.

**Gate de implementação:** o recheck atual de membership seguido de retorno do DTO é insuficiente para uma promessa sobre emissão HTTP. Antes de admitir D03.1, congelar uma fronteira verificável entre executor e transporte que ordene a liberação de conteúdo e o commit de revogação em processos distintos. A família semântica permanece a mesma; não introduzir uma segunda política no servidor ou no browser.

Estratégia candidata para essa ordem: um fence de divulgação por `(realm, world, principal)` coordenado no PostgreSQL existente. A preparação de Frame/leitura S3 acontece sem segurar esse fence. A liberação final adquire um permit compartilhado, revalida presença/membership/capacidade com leitura fresca e o conserva até o transporte aceitar a emissão ou abortar. Revogação exige o fence exclusivo antes de atualizar a membership e conserva-o até COMMIT. A implementação deve especificar a ordem dos locks e uma duração limitada; não executar HTTP/S3/modelo dentro da transação semântica de revogação. Não basta um mutex em memória se duas instâncias puderem atender o mesmo World.

Assim, revogação que vence antes do permit final impede a resposta preparada; uma divulgação que já ganhou o permit é ordenada antes da revogação, que só se confirma depois de esse permit terminar. Se a emissão não terminar dentro do orçamento, abortá-la e liberar recursos; não retornar um receipt de revogação antes de seu commit. A liberação precisa fazer parte do caminho comum do executor, com o transporte fornecendo apenas o passo de emissão, e ser exercida por todos os consumidores. O nome/API exatos desse mecanismo só devem ser congelados depois de verificar os recursos reais de lifecycle do servidor Effect; este documento não alega que já existam.

Um teste que pause apenas antes do último SELECT demonstra reautorização, mas não fecha a janela posterior ao SELECT. São necessários os dois ordenamentos abaixo. Se o mecanismo real não conseguir garanti-los, o incremento fica bloqueado nesse gate e a documentação não pode chamar a checagem anterior de prova equivalente.

## Oráculos necessários, com componentes reais

Estes são checks a implementar, **não resultados executados**. Reusar os fixtures reais de PostgreSQL/S3/Better Auth, o processo CLI e os padrões de barreira de [EX15](../../tests/integration/worlds-corrections-independent/README.md). Cada cenário usa recursos descartáveis próprios. Papéis normais atendem requests; o papel de migração pode observar/segurar barreiras do harness, nunca representar uma identidade privilegiada de usuário.

| ID local | Testemunha e resultado requerido |
| --- | --- |
| SH-01 | Owner e destinatário autenticam por Better Auth real; owner cria/importa World, consulta ausência, concede por UUID exato e revision null. Viewer lê mesmas claims/proveniência/bytes S3 pelo executor HTTP e CLI, sem storage URL, receipt do owner ou correção privada. |
| SH-02 | Terceiro sem membership, viewer pedindo gestão e viewer pedindo import/correção/replay recebem negação uniforme. Comparar contagens SQL/S3 antes/depois: nenhuma captura, Case, correção, membership ou receipt de mutação negada. |
| SH-03 | Dados diferindo só em World inacessível, memberships/Questions/correções privadas produzem observações permitidas equivalentes para viewer/terceiro: payload, status, headers relevantes, contagens, seleção e explicação. Normalizar apenas requestId/FrameRef novos e independentes; não ignorar campos funcionais. |
| SH-04 | O owner não consegue compartilhar seu Frame histórico/Question por passar a referência ao viewer. Viewer gera e relê seu próprio Frame; ambas as leituras passam por direitos atuais. `scopedCorrections` não expõe autoria do owner como current-principal. |
| SH-05 | Dois processos repetem mesma concessão/opID: uma transição, receipt e outbox. Identidade igual/intenção diferente conflita. Duas concessões com IDs distintos e expectativa de ausência produzem uma transição e um Stale. Revoke/grant concorrentes respeitam a revisão e o domínio membership. |
| SH-06 | Grant → revoke → replay do grant original: resultado histórico idêntico, membership continua revoked e não há escrita extra. Regrant exige revisão atual e novo opID; pedido antigo de ausência fica Stale. Revogar novamente com revisão atual é no-op auditado sem incremento. |
| SH-07 | Viewer prepara Inspect/OpenEvidence; barreira real antes do permit final. Outro processo confirma revoke via operação pública. Liberar a leitura produz somente NotFoundOrDenied, sem documento/Frame privado. Repetir para Frame retido e logout, sem SQL direto como caminho de produto. |
| SH-08 | Barreiras reais depois da última leitura de autorização e antes da entrega ao transporte: provar que revoke não confirma atravessando um permit já adquirido, e que nova divulgação perde para revoke já confirmado. Executar em dois processos e observar ausência de corpo privado quando revoke vence. Não substituir por Promise de provider falso. |
| SH-09 | SIGKILL em fronteiras de commit de grant/revoke: membership, revisão, operation, receipt e outbox aparecem todos ou nenhum. Após reinício, mesmos bytes/opID reproduzem o resultado único. Não alegar atomicidade distribuída com identidade/S3. |
| SH-10 | Migração real do perfil atual com histórico preservado; owner/viewer constraints e grants positivos/negativos. Falhar diante de owners ambíguos. Papel identity não altera membership; authority não lê identity; clientes não importam SQL/authority. |
| SH-11 | CLI exige operationId/revisão/UUID, conserva retry e separa JSON stdout/erros stderr. Browser esconde controles negados, não os usa como autorização, limpa conteúdo após negação e não anuncia receipt histórico como grant atual. `--help` continua explícito. |
| SH-12 | Perfil de dados não admitido/hold/apagamento exigido permanece bloqueado; nenhuma UI apresenta revoke como apagar, garantir esquecimento, remover backup ou concluir D03. |

## Consumidores e allowlist sugerida após congelamento

A atribuição executável está em EX20–EX23 de `planning/execution.json`; a tabela abaixo descreve a divisão. A cerca tem handoff privado próprio, congelado antes de seu adapter; o núcleo de membership não pode ser ativado sem ela. Arquivos compartilhados recebem um único dono.

| Segmento/dono sugerido | Caminhos a atribuir | Contrato consumido |
| --- | --- | --- |
| Core/contratos — worker-1 | Novos `packages/contracts/src/sharing/**` e testes; `packages/ontology/src/access/sharing/**`; extensão delimitada de `access/world.ts`, `commit/{intent,mutation,receipt}.ts`, `ports/worlds/{basis,context,persistence}.ts` e testes respectivos | Roles/capacidades, operações, revisões, replay e audience deste documento. Não criar autorização paralela. |
| Identidade — worker-2 | Novo `apps/server/src/identity/sharing/**` e testes; porta estreita proposta em `packages/ontology/src/ports/sharing/**` atribuída ao core antes do adapter | Elegibilidade exata de PrincipalRef pelo pool real identity; nenhuma busca por email nem transferência de credencial. |
| Composição/fence/migração — root | `packages/ontology/src/semantic/executor.ts`; pontos de união de `packages/contracts/src/worlds/{operations,api}.ts`; `apps/server/src/{composition,http/**}.ts`; grants/readiness; **nova** migração numerada pelo integrador, `ops/migrations/run.ts` e fixtures | Mesma execução/finalização em todas as famílias; ordem de divulgação/revogação testável; histórico SQL preservado. O fence não entra como API presumida sem revisão. |
| CLI — worker-3, revisão por outro agente | Novo `apps/cli/src/sharing/**` e composição delimitada em `worlds/{command,transport,output}.ts`, testes de processo | Requests públicos explícitos, nenhuma política local; replay histórico distinguido do estado atual. |
| Web — worker-2, revisão por outro agente | Novo `apps/web/src/features/sharing/**` e composição delimitada de estado/transportes existentes; testes de componentes e browser | Papéis para apresentação, confirmação da audiência completa, destinatário exato, revisão e recuperação de Stale. |
| Prova independente — worker distinto dos autores | `tests/integration/d03-sharing/**`, `tests/security/d03-sharing/**`, `tests/acceptance/d03-sharing/**` | SH-01–12 com componentes reais; falha volta ao dono, sem editar resultados esperados para aprovar. |

Decisões de execução: audiência de evidências/claims de todo o World, somente viewer, exclusão de correções/Questions/Frames privados do owner e elegibilidade mínima por UUID estão congeladas. Reusar o mesmo executor, o commit e o perfil retido; nenhuma operação de apagamento está admitida. A ordem de revogação será coordenada por chave de membership no mesmo PostgreSQL, usando a cerca descrita em `disclosure-fence.md` e seu handoff revisado. Os gates de composição, emissão, SQL e prova continuam pendentes até execução independente; D03, apagamento e restore não estão concluídos.
