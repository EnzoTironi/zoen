# D02 — identidade reversível entre assuntos

**CANDIDATO para revisão, 2026-09-05. Não congela API, não atribui EX24 e não autoriza implementação ou ativação.** A base examinada é `37b09f5`. As decisões recomendadas abaixo ainda precisam ser aceitas pelo integrador e confrontadas com os oráculos independentes. Nenhuma operação, tabela ou campo proposto neste documento existe por ter sido descrito aqui.

## Objetivo e autoridade

Uma pessoa encontra dois identificadores de assunto nos documentos do seu World e não sabe se representam o mesmo compromisso. Ela examina as fontes de ambos, responde explicitamente “mesmo assunto”, “assuntos diferentes” ou “não sei” e consegue corrigir essa decisão depois. A associação pode tornar duas claims comparáveis; não muda o que qualquer fonte disse, não escolhe a fonte correta e não confirma pagamento.

As leis vigentes são [invariants.md](../invariants.md), sobretudo INV-02–10, 13, 20 e 21, e a composição segue [architecture.md](../architecture.md). [D02 no roadmap](../roadmap.md) separa correção local de merge/split e stewardship completos. Os mapas [C024/C025](../../planning/capability-map.json) e [ZN-0038/0039/0040](../../planning/ticket-map.json) preservam esses requisitos. Foi consultado somente o registro histórico específico de `SPEC-006` e desses três tickets em [catalog.json](../../reference/2026-09-05/catalog.json); ele esclarece intenção e contraprovas, não reinstala o antigo pacote `ontology`, DDL ou nomes de API como autoridade atual.

| Referência | Significado preservado | Limite desta proposta |
| --- | --- | --- |
| C025 / ZN-0038 | Case de identidade vincula candidatos autorizados, fonte/base e resposta; mudança relevante antes da resposta produz `Stale`, sem atribuição nem candidato oculto. | Par indicado manualmente; não existe busca de candidatos, fuzzy match, paciente ou integração clínica. |
| C024 / ZN-0039 | Merge é declaração versionada e reversível; fontes conservam seus assuntos; autorização não é união de grants; cuts antigos conservam a visão anterior. | Um par dentro do mesmo World e uma interpretação privada. Grants por assunto/fonte e identidade entre Worlds não estão disponíveis. |
| C024 / ZN-0040 | Split acrescenta contradecisão e linhagem; invalida decisões dependentes e mantém história explicável; não adivinha o destino de derivados ambíguos. | Consumidores atuais são Frames, comparação e Cases de correção. Purchase Cases, Watches e datasets derivados do requisito amplo ainda não existem. |

O incremento não conclui C024, C025 ou D02 completos. Também não conclui apagamento, restore, stewardship compartilhado, identidade genérica de entidades ou D07. Conserva `d01-local-retained-v1`, realm `live`, propósito `personal-records`, dados admitidos não sensíveis, Better Auth, PostgreSQL e S3 atuais. Não precisa de modelo, diretório externo, Fly ou outro provider novo.

## O que existe e o que precisa mudar

| Consumidor atual | Evidência no código | Consequência para o contrato |
| --- | --- | --- |
| Leitura literal | [claims.ts](../../packages/authority/src/knowledge/d01/claims.ts) filtra `(world_id, realm, subject_key)`; [inspect.ts](../../packages/authority/src/knowledge/d01/inspect.ts) consulta uma chave e grava o Frame/pins sob snapshot. | Uma relação não pode ser entregue apenas gravando uma linha. Precisa de uma leitura que a consuma explicitamente. |
| Comparação | [selection.ts](../../packages/authority/src/knowledge/d01/selection.ts) exige igualdade literal de `subjectKey`, mesmo predicado, valores conhecidos, períodos sobrepostos e moedas comparáveis antes de marcar conflito. | Não substituir as chaves dos objetos `VisibleClaim` para enganar o comparador. A equivalência precisa ser entrada explícita de uma comparação com escopo. |
| Base e guards | [basis.ts](../../packages/authority/src/ports/d01/basis.ts) fecha `DomainCut` em cinco domínios; `ReadSet.identities` existe, mas [guards.ts](../../packages/authority/src/commit/guards.ts) rejeita qualquer lista não vazia. | A existência desse campo não significa suporte a identidade. É necessário versionar e validar a dependência real, inclusive ausência, sem retirar os demais domínios do cut. |
| Correção privada | [scope.ts](../../packages/authority/src/knowledge/corrections/scope.ts), [frame.ts](../../packages/authority/src/knowledge/corrections/frame.ts) e [projection.ts](../../packages/authority/src/knowledge/corrections/projection.ts) vinculam principal, World, Frame, assunto literal e intervalo. | Uma associação não move uma correção de A para B nem autoriza escolher uma claim de B numa correção literal de A. |
| Confirmação e undo | [propose.ts](../../packages/authority/src/knowledge/corrections/propose.ts), [answer.ts](../../packages/authority/src/knowledge/corrections/answer.ts) e [undo.ts](../../packages/authority/src/knowledge/corrections/undo.ts) usam base retida, consequência exata e eventos compensatórios. | Reusar o executor e a fronteira de commit; não criar um fluxo de confirmação que escreva direto no banco. Não fingir que o shape de uma correção de valor já representa identidade. |
| Compartilhamento | [d03-sharing.md](d03-sharing.md) concede evidências/claims do World e exclui interpretações, Questions e Frames privados do owner. | Fazer o viewer consumir uma associação privada alteraria sua observação e a audiência já admitida. A primeira proposta mantém essa declaração privada. |

## Recorte recomendado: declaração privada de um par em intervalo explícito

Um assunto deste incremento é a âncora **`(WorldRef, subjectKey literal)` já presente em claims admitidas**. `PrincipalRef`, `user.id`, email de login, sessão, nome de pessoa, identidade de registro da fonte e assunto de domínio permanecem conceitos diferentes. Não criar um cadastro paralelo de usuários ou traduzir um `subjectKey` em conta. Chaves iguais em Worlds distintos não são o mesmo assunto. Chaves diferentes com nomes parecidos também não são equivalentes por inferência.

O owner informa exatamente duas chaves distintas do mesmo World e um `DateInterval` civil não vazio, com início inclusivo e fim exclusivo. Ambas precisam ter evidência admitida observável por ele. Ausência não cria um assunto, alias ou placeholder automaticamente. O par é normalizado em ordem determinística de bytes para comparação/digest; essa ordem não atribui precedência semântica a uma fonte.

**Recomendação temporal:** admitir somente declarações com intervalo explícito. Para o mesmo par, intervalos iguais podem receber nova decisão ou undo; intervalos disjuntos convivem; intervalos sobrepostos e diferentes ficam `Unsupported` até existir uma operação explícita de particionamento. Não estender setembro a outubro, não inferir identidade por intervalo desconhecido e não transformar campo ausente em “todos os tempos”. Split parcial de uma declaração exige outro incremento; este split usa o intervalo exato confirmado.

**Recomendação de tamanho, ainda não autorizada:** trabalhar com pares isolados. Cada âncora participa de no máximo um par com declaração efetiva (`same-as` ou `different-from`) em qualquer instante. Não admitir A=B e B=C com sobreposição temporal, nem A≠B e B≠C nesse mesmo recorte, nem escolher uma aresta para remover. Um terceiro vínculo que violaria esse limite fica `Unsupported` antes do commit, após autorização. `unknown` não cria vínculo nem reserva a âncora. A equivalência simétrica A=B/B=A é a mesma intenção normalizada; a igualdade reflexiva de uma âncora consigo mesma já é literal e não cria Case. O limite abrange também distinções para não aparentar uma teoria global de identidade enquanto se ignora a substituição de iguais em relações com terceiros.

### Decisão necessária: pares isolados ou fechamento transitivo

Esta restrição é uma **escolha de alcance de produto proposta**, não uma consequência das leis existentes, da infraestrutura ou do nome `same-as`. A relação de identidade não pode deixar de ser transitiva por conveniência: se um produto aceitar A=B e B=C no mesmo World/autor/intervalo, precisa tratar A=C coerentemente, inclusive em distinções, representantes, comparação e split. A opção de pares evita admitir essa segunda aresta; não a aceita para depois ignorar seu significado.

| Alternativa a decidir | Efeito em Frame/Question e reversão | Relação com o requisito amplo |
| --- | --- | --- |
| P — pares isolados, recomendada para este primeiro incremento | Frame/Question contêm exatamente duas âncoras e um intervalo. Toda relação efetiva a terceiro que se sobreponha impede a proposta/confirmação. Split/undo afetam somente o par previamente congelado. Cases concorrentes protegem a ausência de terceiro vínculo. | Entrega uma fatia local de C024/C025. É deliberadamente mais restrita que a resolução de sujeitos/representantes e fechamento de impacto de SPEC-006; não recebe o selo dessas capacidades completas. |
| G — grafo com fechamento transitivo | Frame/Question precisam expor e vincular todos os componentes autorizados afetados, distinções incompatíveis, efeitos da união, arestas e partição de split; remover uma aresta pode não separar nada quando existe outro caminho. Undo precisa revalidar todo esse fechamento e nunca separar automaticamente um subconjunto não confirmado. | Aproxima o significado amplo preservado, mas exige contrato adicional de conflito entre same/different, ciclos, identidade temporal, limite de componente e split como partição explícita. Não é trabalho autorizado por esta proposta. |

O roadmap mantém merge/split e stewardship como incrementos próprios. O catálogo fala em compute do representante sob cut e recalcular dependentes, não impõe pares isolados. Portanto root precisa aceitar P como entrega parcial ou escolher G e devolver o contrato à elaboração. Não transformar P em definição permanente de C024, nem publicar `same-as` como API geral com suporte silenciosamente incompleto. Quando houver ampliação, a semântica dos Frames/Questions P já salvos continua exata; não acrescentar terceiro membro retroativamente por fechar o grafo atual.

A declaração é de identidade de domínio **naquele intervalo**, não uma regra de correção ou classificação. Novas claims admitidas posteriormente para essas mesmas âncoras podem ser comparadas sob a declaração em uma nova leitura, apenas na interseção com o intervalo declarado. A confirmação precisa dizer isso. A associação não passa para outro assunto, predicado, World, autor, período ou definição por analogia.

## Audiência e autoria propostas

A audiência recomendada da declaração, do Case, da resposta, do receipt e da explicação é **somente o principal autor, owner ativo do World, no propósito atual**. Não incluir a declaração automaticamente na concessão D03 de evidências/claims. Não publicar o ID do autor nem o receipt privado como justificativa para outro principal. Se o produto quiser que uma associação governe a leitura dos viewers, será outra decisão explícita de audiência e outro contrato de publicação; não uma consequência implícita deste documento.

| Ação/observação | Owner autor atual | Viewer | Ausente/revogado/outro World |
| --- | --- | --- | --- |
| `Inspect` literal e `OpenEvidence` existentes | Com os direitos atuais | Com os direitos atuais de D03 | Negação uniforme |
| Preparar, resolver, explicar ou desfazer a declaração privada | Permitido pelo executor após autorização e guards | `NotFoundOrDenied`, inclusive replay e referências conhecidas | `NotFoundOrDenied` |
| Frame/Question/receipt privado de outro autor | Negado | Negado | Negado |
| Leitura identity-aware deste incremento | Somente interpretação do autor atual | Não disponível neste recorte; a leitura literal permanece | Negado |

O papel `owner` já existente exerce essa revisão local; não adicionar `steward` como papel oculto, capability enviada pelo browser ou login SQL. A autorização antecede lookup do Case, consulta de candidates e resolução de relações. Leitura e replay reautorizam e usam o mesmo fence de divulgação; revogação de World/sessão pode impedir até uma explicação preparada. A associação nunca amplia grants, altera memberships ou mistura fontes de outro World. Não anunciar que o recorte de ACL por World prova o caso amplo de dois assuntos com ACLs de fonte diferentes.

A contraprova de privacidade deve comparar viewers antes/depois de declarações privadas do owner: conteúdo literal, seleção, contestação, contagens, ordenação, erros e headers permitidos não mudam por essas declarações. Não retornar revisão global de identidade, digest de candidatos ocultos, número de Cases privados ou aviso de “associação oculta”. IDs novos aleatórios de Frame podem ser normalizados somente como na prova D03, sem remover campos funcionais.

## Leitura e efeito na comparação

Recomenda-se uma **operação de leitura explícita de par** na nova família, mantendo `Inspect` D01 literal e seu DTO inalterados neste incremento. A nova leitura recebe as duas âncoras e o intervalo; devolve um Frame privado próprio, contendo as claims originais de cada lado, a relação efetiva naquele cut/intervalo e a explicação da comparação. Não aceitar esse novo tipo de Frame silenciosamente como Frame D01 de correção.

1. As claims conservam `claimRef`, `evidenceRef`, `sourceRef`, `source`, `recordId`, `recordIndex`, `subjectKey`, valor, período original e `verification`. Os bytes/digest/localização S3, pins de origem e atribuição da fonte não mudam.
2. Sem decisão, a relação entre as duas chaves é **não resolvida**. Isso não afirma “diferentes”. O Frame mantém os lados separados; não cria conflito entre eles apenas porque os valores divergem.
3. `different-from` confirmado mantém os lados separados no intervalo; valores diferentes não são conflito entre o mesmo assunto. Não deduzir igualdade com um terceiro por exclusão.
4. `same-as` confirmado permite tratar somente esses dois assuntos como equivalentes na comparação, dentro do intervalo declarado. É uma condição de comparabilidade, não seleção da verdade: predicado, moeda/unidade, escopo e tempo continuam necessários. Para duas claims, a interseção de seus períodos conhecidos com o intervalo consultado precisa ser não vazia. Fora desse intervalo não há conclusão de identidade desta declaração; períodos desconhecidos não ganham sobreposição por inferência.
5. Exemplo: A afirma `100 BRL` e B afirma `120 BRL`, ambas para setembro. Sem relação, são duas observações de assuntos não resolvidos entre si. Após `same-as` em setembro, a comparação em setembro pode marcar divergência e permanecer `unresolved`; não elege 100 nem 120. Após split, a comparação nova volta a manter os assuntos separados. Um Frame salvo durante o merge continua explicando a divergência que exibiu.
6. A apresentação identity-aware deve explicitar **o intervalo a que sua comparação se aplica**. Não reutilizar um badge global D01 como se o merge valesse durante todo o período original de cada claim. A decisão de schema do novo resumo comparativo é gate: preservar distinção entre não comparável, desconhecido e conflito; não inventar `selected` quando parte do intervalo não tem suporte.

O representante, se necessário na explicação privada, é uma projeção do par no cut e intervalo: durante `same-as`, a menor chave em ordem de bytes serve apenas como representante determinístico; antes/depois, cada chave representa a si. Não é novo identificador de origem, não é redirect persistente e não muda o parâmetro exigido para abrir um Frame histórico. O cliente não o envia como substituto de uma claim.

A comparação nova consome uma equivalência explícita, com referência/escopo, sem reescrever os objetos de fonte para passar pelo teste de igualdade literal existente. Os limites existentes de claims/bytes continuam a valer sobre **o conjunto completo do par**; ultrapassar o limite retorna `QuotaExceeded`, sem truncar candidatos e fingir que a lista exibida é a base completa. Não acrescentar ranking, probabilidades, similaridade, inferência de nome/email ou LLM.

## Case de ambiguidade e ciclo de decisão

Os nomes abaixo são rótulos candidatos para revisão, **não endpoints ou schemas congelados**. Reusar envelopes fechados, `WorldRef`, `OperationId`, erros existentes e `HttpApiClient` na mesma composição; a família e o versionamento público precisam ser definidos no gate final.

| Passo candidato | Intenção que precisa estar explícita | Resultado e compromisso |
| --- | --- | --- |
| `InspectIdentityPair` | Par literal, intervalo; opcionalmente uma referência de Frame próprio histórico. | Frame privado com fontes/claims originais e relação efetiva. Não escreve uma declaração de identidade. |
| `ProposeIdentityResolution` | Referência do Frame de par exibido e `operationId`. | Case/Question privado com o conjunto exato de alternativas `same-as`, `different-from`, `unknown`, seus efeitos e digest. Nenhuma alternativa pré-selecionada. |
| `ResolveIdentity` | Question exata, digest da consequência/alternativas liberadas, escolha e `operationId`. | Confirma a alternativa no mesmo commit ou retorna `Stale`/erro fechado. `unknown` registra a resposta, sem atribuir identidade. |
| `UndoIdentityAssertion` | Referência exata da declaração efetiva, Frame de par recém-inspecionado e `operationId`. | Nova contradecisão com vínculo ao alvo e estado anterior; não apaga a declaração, nem usa um cut antigo como autorização atual. |

O Case congela autor, propósito, World, par normalizado, intervalo, Frame, fontes e digests, relação atual, alternativas permitidas, consequência de cada alternativa e a base completa. A UI/CLI mostra que `same-as` afeta a comparação atual e futuras leituras das mesmas âncoras dentro do intervalo, e que o efeito é privado. Uma mudança de alternativa depois de responder com o mesmo `operationId` é `Conflict`; não gerar um segundo ID automaticamente no retry.

A resposta deve corresponder a uma alternativa que já foi exibida e incluída no digest. Se a revisão optar por uma proposta com uma única consequência e respostas `confirm/unknown`, é necessário reconfirmar esse desenho antes de congelar a API; não reutilizar o Question de correção atual sem distinguir as duas semânticas.

| Relação efetiva no intervalo | Resposta `same-as` | Resposta `different-from` | Resposta `unknown` |
| --- | --- | --- | --- |
| Não resolvida | Acrescenta associação | Acrescenta distinção explícita | Registra desconhecimento; continua não resolvida |
| `same-as` | Reafirmação auditada, sem nova mudança efetiva | Acrescenta contradeclaração ligada à associação: split | Registra desconhecimento; não desfaz a associação existente |
| `different-from` | Acrescenta associação ligada à distinção anterior | Reafirmação auditada, sem nova mudança efetiva | Registra desconhecimento; não apaga a distinção existente |

Reafirmação e `unknown` resolvem o Case e recebem receipt/outbox próprios, sem fingir transição efetiva de identidade. Repetir a mesma operação retorna exatamente o receipt original após reautorização. Um receipt antigo de merge, replayado depois do split, não recompõe a associação. Estado atual é obtido por nova leitura do par.

Undo só pode mirar a declaração ainda efetiva naquele escopo, conhecida pelo Frame atual. Acrescenta uma contradecisão que restaura a relação efetiva anterior, ou ausência de resolução se não havia anterior. Desfazer uma distinção que havia dividido o par pode voltar a associá-lo: isso deve estar explícito na confirmação. Não equivale a apagar evidência ou “esquecer” a decisão. Se intervenções posteriores mudaram a base ou o alvo já não está efetivo, retorna `Stale`; nova inspeção e intenção são necessárias. O evento de undo não vira um alvo implícito para uma cadeia ilimitada de inversões; o próximo alvo vem da nova projeção efetiva, como na correção atual.

## Commit, guards e compatibilidade histórica

Todos os passos semânticos usam o mesmo executor e o mesmo `commitMutation` SERIALIZABLE, locks em ordem comum, identidade de operação por principal/World/operação, reautorização anterior ao replay, receipt e outbox atômicos. Nenhum cálculo de candidatos depende de rede ou modelo dentro da transação. Mantém-se o limite atual de três tentativas totais para serialização/deadlock; retry não renova o consentimento nem muda as alternativas.

A base precisa capturar fontes admitidas dos dois lados, predicados de claims de ambos, presença/membership, head e todos os domínios atuais. Também precisa capturar relação/versão e ausência de associação conflitante que justificam admitir o par. Guardar só as duas linhas já existentes não protege um terceiro vínculo inserido entre pergunta e resposta. A decisão inteira deve ser revalidada sob os locks comuns, incluindo esse predicado de ausência.

**Recomendação de versionamento a revisar:** acrescentar um domínio explícito de identidade e uma nova versão privada de `InternalBasis`/dependências. Todo Frame novo conserva o `DomainCut` completo; não tirar `cases`, `membership` ou outros domínios para evitar `Stale`. Toda transição efetiva/undo de identidade avança o domínio de identidade uma vez; criar/resolver Case avança `cases`. Reafirmação/unknown não avançam a revisão efetiva de identidade, mas conservam o evento de Case/receipt/outbox. A implementação deve tornar essa disciplina verificável em todos os writers.

Isso exige uma solução de compatibilidade **antes** da migração:

- Bases antigas com os cinco domínios, Frames visíveis antigos, Questions, receipts e bytes de fonte ficam intactos. Não preencher retrospectivamente `identities: 0` ou outra revisão, não recalcular digest/read set e não “atualizar” a base guardada para fazê-la passar.
- O leitor versionado reconhece a representação privada antiga como tal. Um novo ato que exija identidade não pode derivar consentimento dela: retorna `Stale` e pede uma nova leitura. Não transformar incompatibilidade de versão em `Unavailable` permanente, nem quebrar a leitura histórica autorizada.
- Replay de operação já registrada conserva resultado histórico exato e precede a rejeição de base obsoleta, após autorização. Os handlers atuais carregam Frames/Cases antes de parte do caminho de replay; essa ordem precisa ser revisada ao ampliar o decoder para não inviabilizar receipts antigos.
- Ler `atFrame` continua devolvendo o Frame salvo do mesmo principal, World, propósito e âncora/par/intervalo, sujeito aos direitos atuais. Não misturar claims novas, relações atuais ou representante novo no Frame antigo. O formato público de Frame D01 não recebe campos obrigatórios retroativos.
- A alternativa de reaproveitar apenas `cases` como domínio de todas as mudanças de identidade é possível somente se revisada com todos os writers/readers e a prova de ausência. Não a assumir como atalho para deixar `ReadSet.identities` fictício ou ignorado. A recomendação acima torna a dependência explícita e assume o custo de compatibilidade. Nenhuma das duas alternativas dispensa a prova de que todo writer de identidade invalida os Cases que dependem dela.

O próprio Case recém-criado não deve se tornar `Stale` pela sua inserção. Só é permitido avançar na base guardada o incremento de `cases` que essa mesma proposta acabou de causar, de forma análoga à correção atual; nenhum cut externo, fonte, relação ou alternativa é renovado. Uma importação nova, alteração de membership, correção concorrente ou declaração de identidade posterior continua invalidando conservadoramente a base conforme o cut completo.

## Split e fechamento de impacto no recorte atual

O split não particiona linhas físicas, não troca `claims.subject_key`, não renomeia fontes e não distribui objetos derivados por heurística. O estado novo deriva dos eventos de identidade no novo cut; os eventos anteriores e a cadeia de undo permanecem explicáveis.

- **Comparação nova:** considera o par separado no intervalo; marca falta de resolução quando não há declaração aplicável. Não conserva um resultado combinado como fato atual após remover a sua base de identidade.
- **Frames salvos:** preservam o representante, o escopo e a explicação que possuíam, com pins necessários. Seu histórico não é reprocessado pelo split.
- **Cases pendentes de correção/identidade:** mudança de identidade invalida a base completa; resposta antiga retorna `Stale` sem nova declaração/correção. A proposta nova exige nova leitura e confirmação. O indicador “pendente” da UI não é prova de que a base ainda vale.
- **Correções já aplicadas:** mantêm autoria, assunto literal e intervalo originais. Não herdar a correção de A em B durante merge, não migrá-la de volta durante split e não apagá-la. A nova leitura pode mostrá-las separadamente por âncora ao próprio autor; continuam anotações privadas, não modificações do resultado automático das fontes. Corrigir um resumo combinado permanece fora deste incremento.
- **Derivados ainda ausentes:** não implementar tabelas vazias de Watches, purchase Cases ou datasets para preencher ZN-0040. Antes de qualquer um desses consumidores existir, ele precisa registrar sua dependência de identidade e provar invalidação/estado `unresolved` quando a atribuição se tornar ambígua. Esta entrega não pode alegar ter fechado esse impacto futuro.

## Contraprovas exigidas antes de liberar código

Estes são oráculos propostos, **não testes executados**. Funções puras usam entradas sintéticas diretas; efeitos usam PostgreSQL/S3/Better Auth reais, papéis normais e o executor comum. Uma revisão independente precisa preservar a falha antes de qualquer correção relevante.

| ID candidato | Testemunha necessária |
| --- | --- |
| ID-01 — fonte preservada | Importar A/B por caminhos JSON e CSV atuais; registrar bytes/digests/refs/chaves. Merge, split e undo não alteram nenhuma fonte, claim original, pin histórico ou receipt. `OpenEvidence` continua byte a byte igual. |
| ID-02 — comparação com escopo | A=100/B=120, mesmo predicado/moeda e períodos sobrepostos: sem relação não há conflito entre assuntos; `same-as` em setembro permite conflito em setembro; split remove essa comparabilidade atual. Outubro, moeda incompatível, período desconhecido e predicado não admitido não são promovidos a conflito válido. |
| ID-03 — ambiguidade e unknown | Nomes parecidos/chaves distintas não se associam. Case apresenta somente o par autorizado e alternativas exatas. `unknown` não é `different-from` e não desfaz relação já efetiva. Não há seleção default nem inferência por exclusão. |
| ID-04 — Stale da resposta | Após preparar Case, admitir nova revisão de fonte/claim relevante, alterar membership ou relação. Responder à Question antiga devolve `Stale`; zero evento de resolução, atribuição, receipt/outbox de mutação concluída. Não atualizar digest/oráculo para acomodar a mudança. |
| ID-05 — ausência e terceira aresta | Dois processos tentam A=B e B=C com intervalos sobrepostos, preparados quando B estava sem vínculo. Nunca resulta grupo de três; no máximo uma transição confirma e a outra fica `Stale` ou, após nova leitura, `Unsupported`. Duplicatas simétricas mantêm o par canônico. |
| ID-06 — reversibilidade | Não resolvida → same → different → undo restaura same em cut novo, com linhagem; undo de same original restaura ausência quando ainda for o alvo efetivo. Alvo superado/Frame antigo retorna `Stale`. Reafirmação não incrementa revisão efetiva. |
| ID-07 — receipt histórico | Merge → split → replay exato do merge retorna o primeiro receipt, sem reassociar. Mesmo opID/intenção diferente conflita. Nova associação requer novo Case/base/confirmação. Replays continuam privados e reautorizados. |
| ID-08 — privacidade | Viewer/terceiro não abre Case/Frame/receipt de identidade mesmo conhecendo IDs. Pares de estados diferindo só nas declarações privadas do owner produzem a mesma leitura literal permitida do viewer, inclusive metadados. Revoke/logout vencedor do fence impede explicação preparada. |
| ID-09 — impacto atual | Case de correção literal aberto antes do split fica `Stale`; correção já aplicada conserva assunto/autor/intervalo e não é herdada pela outra âncora. Frame antigo conserva comparação/representante antigos. A própria criação do Case não invalida sua única resposta imediata. |
| ID-10 — atomicidade | SIGKILL nos limites reais de confirmação/undo: evento de identidade, estado do Case, revisões, operação, receipt e outbox aparecem todos ou nenhum. Reinício com mesmos bytes/opID retorna um único resultado. Sem promessa de ACID com S3/identidade. |
| ID-11 — migração e compatibilidade | Aplicar extensão sobre histórico real das migrações vigentes; comparar linhas antigas, digests e ACLs. Frames/receipts antigos ainda leem/replayam; bases antigas que não podem governar ato novo ficam `Stale`, sem retropreenchimento. Papel de cliente/identity não escreve autoridade. |
| ID-12 — superfícies e limites | Web/CLI enviam o mesmo par/intervalo/digest/operationId, conservam retry e exigem nova confirmação após `Stale`; UI distingue declaração privada de fato da fonte e receipt de estado atual. Limite do conjunto excedido falha inteiro, sem candidates ocultados pela paginação/truncamento. |

O cenário histórico de “paciente oculto” é um requisito de não interferência, não autorização para dados clínicos neste perfil. Sua testemunha local usa assuntos não sensíveis e Worlds/principals reais separados. O caso amplo de ACL distinta por assunto/fonte continua pendente até esse modelo existir, sem rebatizar ACL por World como prova equivalente.

## Consumidores reais e gates para um futuro pacote

| Consumidor a integrar | Resultado concreto necessário |
| --- | --- |
| Contratos públicos / `ApplicationApi` | Nova família fechada e Frame de par distinguível, com versionamento e erros decididos. Nenhum campo livre de role/capability, representante ou cut fornecido como autoridade pelo cliente. |
| Executor / commit / guards | Dispatch explícito, capacidade derivada da operação, base completa e dependências reais de identidade, atomicidade/replay e fence existentes. |
| PostgreSQL / migração | Eventos privados, vínculo de predecessor/undo, Case/Question tipados e revisões; constraints do recorte de pares/intervalos. Ordem e DDL pertencem ao integrador; nenhum schema é aprovado aqui. |
| Leitura/comparação | Consulta do par sob um único snapshot, preservação das claims e comparação com equivalência/tempo explícitos. Uma função não importada não entrega a capacidade. |
| Correções atuais | Guards reconhecem mudança de identidade, preservam versões antigas e não aceitam correção combinada por acidente. |
| Web/CLI | Journey completa: informar par/intervalo → inspecionar fontes → responder Case → consultar relação/comparação atual → split/undo explícito. Sem botão que execute SQL ou publique interpretação ao viewer. |
| Prova independente | Leis, integração, concorrência, migração, emissão e navegador/CLI separados. Build verde não aceita sem os oráculos correspondentes. |

Antes de atribuir EX24, registrar decisões para: **(1)** audiência privada versus publicação compartilhada — recomendação privada; **(2)** âncoras literais e existência exigida — sem alias/fuzzy; **(3)** limite de duas âncoras e ausência de transitividade arbitrária; **(4)** intervalo obrigatório e apenas igualdade/disjunção de escopos; **(5)** alternativas exatas do Case e semântica de unknown/reafirmação/undo; **(6)** Frame/operação de leitura separados e resumo comparativo com tempo explícito; **(7)** domínio/dependências de identidade e compatibilidade de bases antigas; **(8)** incorporação do domínio nos guards de correção e limites de impacto futuro; **(9)** nomes/shapes/rotas versionados e orçamento de tamanho usando limites admitidos; **(10)** owners, migração, consumidor, revisão e oráculos de cada segmento.

Se uma dessas decisões exigir outra audiência, cadeia transitiva, intervalo parcial, atribuição de dado derivado ou regra reutilizável, o contrato volta à revisão antes de iniciar esses caminhos. O documento propõe um incremento executável e limitado; não transforma a amplitude de SPEC-006 em operações já disponíveis.
