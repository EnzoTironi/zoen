# D02 — identidade reversível entre assuntos

**CANDIDATO para revisão, 2026-09-05. Não congela API, não atribui EX24 e não autoriza implementação ou ativação.** A base examinada é `37b09f5`. As decisões recomendadas abaixo ainda precisam ser aceitas pelo integrador e confrontadas com os oráculos independentes. Nenhuma operação, tabela ou campo proposto neste documento existe por ter sido descrito aqui.

## Objetivo e autoridade

Uma pessoa encontra dois identificadores de assunto nos documentos do seu World e não sabe se representam o mesmo compromisso. Ela examina as fontes de ambos, responde explicitamente “mesmo assunto”, “assuntos diferentes” ou “não sei” e consegue corrigir essa decisão depois. A associação pode tornar duas claims comparáveis; não muda o que qualquer fonte disse, não escolhe a fonte correta e não confirma pagamento.

As leis vigentes são [invariants.md](../invariants.md), sobretudo INV-02–10, 13, 20 e 21, e a composição segue [architecture.md](../architecture.md). [D02 no roadmap](../roadmap.md) separa correção local de merge/split e stewardship completos. Os mapas [C024/C025](../../planning/capability-map.json) e [ZN-0038/0039/0040](../../planning/ticket-map.json) preservam esses requisitos. Foi consultado somente o registro histórico específico de `SPEC-006` e desses três tickets em [catalog.json](../../reference/2026-09-05/catalog.json); ele esclarece intenção e contraprovas, não reinstala o antigo pacote `ontology`, DDL ou nomes de API como autoridade atual.

| Referência | Significado preservado | Limite desta proposta |
| --- | --- | --- |
| C025 / ZN-0038 | Case de identidade vincula candidatos autorizados, fonte/base e resposta; mudança relevante antes da resposta produz `Stale`, sem atribuição nem candidato oculto. | Par indicado manualmente; não existe busca de candidatos, fuzzy match, paciente ou integração clínica. |
| C024 / ZN-0039 | Merge é declaração versionada e reversível; fontes conservam seus assuntos; autorização não é união de grants; cuts antigos conservam a visão anterior. | Componentes transitivos dentro do mesmo World e uma interpretação privada. Grants por assunto/fonte e identidade entre Worlds não estão disponíveis. |
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

## Recorte recomendado: grafo privado com identidade transitiva

Esta revisão escolhe **G: fechamento transitivo completo dentro do escopo autorizado**. Substitui a proposta anterior de pares isolados. A=B e B=C implicam A=C; aceitar as duas primeiras relações e ignorar a terceira seria incorreto. Os limites operacionais abaixo rejeitam a operação inteira quando necessário; não alteram essa lei.

Uma âncora é `(WorldRef, subjectKey literal)` já presente em claims admitidas observáveis pelo owner. `PrincipalRef`, login, email, nome de pessoa e identificador de registro da fonte são conceitos distintos. Nenhuma operação cria conta, alias ou assunto sem evidência. Worlds distintos nunca são unidos. O owner indica manualmente uma ou duas âncoras e um `DateInterval` civil finito, não vazio, com início inclusivo e fim exclusivo. Não há descoberta fuzzy, ranking, LLM ou associação por nomes parecidos.

Toda declaração pertence a um único World, autor e propósito. Em cada instante do intervalo:

- Arestas positivas `same-as` formam componentes conexos. Igualdade é reflexiva, simétrica e transitiva. Ciclos são permitidos e preservados como declarações distintas; remover uma aresta não necessariamente desfaz uma igualdade.
- Uma aresta negativa `different-from` exige que seus extremos estejam em componentes positivos diferentes. Sua distinção vale entre os dois componentes por substituição de iguais, sem se tornar transitiva: A≠B e B≠C não implicam A≠C.
- Um par sem caminho positivo e sem distinção entre seus componentes é `unresolved`. `unknown` é uma resposta humana, não uma aresta nem uma prova de diferença.
- Uma aresta negativa interna a um componente positivo é contradição proibida no commit. Não escolher silenciosamente a declaração mais nova, eliminar uma aresta negativa, limitar o caminho explorado ou mostrar simultaneamente “mesmo” e “diferente”. Um estado persistido inconsistente falha fechado; não é tratado como ambiguidade resolvida por heurística.

Uma relação temporal não se estende por analogia a outro período. Intervalos parcialmente sobrepostos são permitidos, com células temporais explícitas. Intervalo desconhecido de claim não vira identidade eterna nem período conhecido. Novas claims dessas mesmas âncoras podem participar de uma leitura futura dentro do intervalo declarado; o Case deve explicar esse efeito. A declaração não escolhe valor verdadeiro, confirma pagamento ou transmite correção de uma âncora a outra.

## Audiência, fechamento e limites completos

A declaração, o Case, o Frame, a Question, o receipt e sua explicação são privados do **principal autor, owner ativo do World, no propósito admitido**. Viewers D03 continuam usando `Inspect` literal e `OpenEvidence` com os direitos atuais; não consomem essa interpretação. Publicar identidade para viewers exige outro contrato. Não criar papel `steward`, capability fornecida pelo cliente, união de grants ou autenticação paralela.

Autorização antecede lookup, travessia, contagem, quota e replay. A leitura começa nas âncoras indicadas e calcula, sob um snapshot, o menor conjunto fechado por **todas as arestas positivas e negativas efetivas que intersectam o intervalo consultado**, do mesmo World/autor/propósito. Cada extremo encontrado entra no conjunto e expande novamente ambas as espécies de aresta até ponto fixo. Isso inclui componentes vizinhos ligados por distinções e seus caminhos positivos; não depende só do caminho escolhido entre as duas sementes. Claims e evidências de todas as âncoras desse fechamento entram integralmente no Frame, respeitando a seleção temporal vigente e preservando as de período desconhecido como tais. O fechamento espacial cobre a união dos membros relevantes em todo o intervalo, mesmo que uma aresta exista somente em parte dele.

A consulta exclui declarações de outros autores/Worlds **antes** do cálculo do fechamento e dos limites. Referências privadas alheias retornam `NotFoundOrDenied`. Leitura/replay reautorizam e passam pelo mesmo fence de divulgação; revogação vencedora impede a entrega preparada. Não revelar revisão privada, quantidade de Cases ocultos, digest oculto ou “há uma associação que você não pode ver”. O modelo atual de ACL por World não prova ACL distinta por assunto/fonte do requisito amplo.

Orçamento candidato de uma operação, a ratificar antes de código: **32 âncoras no fechamento completo; 128 segmentos efetivos de asserção; 64 células; 200 claims no conjunto completo (`D01_LIMITS.frameClaims` atual); 256 pares de claims por célula; 512 itens de efeito em uma decisão**. Um segmento é uma parte contínua de uma asserção após aplicar retiradas vigentes; vários segmentos da mesma asserção contam separadamente. Pares de comparação são todos os pares não ordenados de claims que precisam ser examinados, sem poda por resultado conhecido; 200 claims não garantem caber nesse segundo limite. Os limites atuais de bytes de fonte permanecem. Esses números são proposta de produto, não benchmark nem admissão de capacidade.

Ultrapassar qualquer limite retorna `QuotaExceeded` para a leitura/proposta inteira, sem Frame ou Question parcial, truncamento, ranking ou paginação interpretada como fechamento completo. A travessia pode parar ao testemunhar excesso, mas não devolver um subconjunto como resultado. Propostas e confirmação também verificam o fechamento prospectivo e seus limites. Não gravar um estado cujo fechamento após a mutação já excede os limites desta família. Uma decisão não pode contornar o limite dividindo silenciosamente o consentimento em commits parciais.

### Recuperação quando claims excedem o orçamento de comparação

**Decisão adicional candidata:** adotar uma inspeção de recuperação explícita, em vez de mudar implicitamente a admissão de imports D01. Uma importação futura pode elevar claims, pares ou fronteiras de períodos acima dos limites da leitura comparativa, sem alterar o grafo. Nesse caso `InspectSubjectIdentity` continua falhando inteiro; isso não pode impedir examinar e desfazer a identidade.

`InspectIdentityRecovery { worldRef, anchor, interval, targetDecisionRef? }` produz um **`IdentityRecoveryFrame` distinto**, privado, com o fechamento completo de âncoras, segmentos de asserções, autoria própria/linhagem e células determinadas somente pelos intervalos de identidade. Para um alvo de undo, inclui todo o intervalo e todos os extremos dos itens do alvo, além do fechamento atual alcançado por eles. Não contém coleção de claims, comparação de valores ou promessa de resumo completo das fontes; declara `comparison: "not-requested"`. Essa ausência é parte explícita do tipo e da intenção, não truncamento de um Frame comparativo. Cada decisão/asserção retém sua referência de proveniência histórica autorizada; abrir a fonte original continua separado, sujeito aos direitos atuais. O Frame não pode alimentar resolução `same-as`/`different-from` nem correção literal.

A recuperação permite **somente propor split ou undo**, mostrando grafo antes/depois, todos os itens de efeito, partições por célula e impacto de identidade exatos. Suas Questions têm discriminante de recuperação e dizem que as consequências comparativas sobre valores não foram calculadas; o consentimento é sobre a transformação completa do grafo. Não preencher `afterCells.comparisons` com lista vazia como se não houvesse divergências: o campo não existe nesse tipo. Nada disso dispensa base completa, fontes/head atuais no cut, autorização, limites de efeitos, ausência concorrente ou revalidação.

Os limites de recuperação são os mesmos **32 âncoras, 128 segmentos e 64 células de identidade, 512 itens de efeito**, verificados para estado atual e prospectivo. Claims, pares de claims e fronteiras de períodos de claims não entram nessa contagem porque não participam desse tipo de leitura. A invariância desses limites do grafo precisa ser provada em **todos os writers de identidade**, inclusive resolução, split, undo e recuperação; importação de claims não modifica o grafo nem suas células. Uma inversão que, por decisões posteriores, excederia o orçamento de grafo continua bloqueada inteira e pode exigir desfazer primeiro essas decisões, explicitamente. Não prometer undo arbitrário de qualquer passado; garantir que excesso de claims sozinho não torne identidade irrecuperável. Uma futura mudança capaz de retirar âncoras/alterar grafo fora dessa família precisa fechar novamente essa obrigação antes de existir.

Oráculo adicional: confirmar identidade dentro do orçamento, importar claims reais adicionais até exceder claims/pares/células comparativas, verificar `QuotaExceeded` sem Frame parcial na leitura normal e completar inspeção de recuperação → Question → undo sob base atual, preservando todas as novas claims. Repetir com períodos desconhecidos e demonstrar que a recuperação não calcula nem fabrica comparação. Esse novo tipo, journey e seus limites precisam de aceitação explícita antes do pacote; até lá a lacuna de recuperação é bloqueio de prontidão, não prova satisfeita.

## Tempo, representantes e comparação

A leitura divide o intervalo consultado em células não vazias determinadas por seus extremos, por todos os extremos de segmentos efetivos do fechamento e por todos os extremos de períodos conhecidos das claims observadas que caiam dentro da consulta. Ordenam-se datas civis e recortam-se esses eventos à consulta. Células adjacentes só podem ser reunidas se o grafo efetivo com referências/linhagem e o conjunto de claims com cobertura temporal forem idênticos; preservar uma fronteira redundante também não autoriza exceder o orçamento. Essa decomposição é determinística no cut.

Em cada célula, o Frame contém os componentes positivos completos, as distinções entre componentes, as claims com suporte temporal e comparações. O representante é a menor `subjectKey` em ordem lexicográfica de bytes UTF-8 de cada componente **naquela célula**. É projeção explicativa, nunca novo ID de origem, redirect, conta ou parâmetro autoritativo de escrita. Não existe um representante ou badge de identidade global se a consulta cruza estados diferentes.

Claims conservam `claimRef`, `evidenceRef`, `sourceRef`, `source`, `recordId`, `recordIndex`, `subjectKey`, valor, período original e `verification`. Bytes/digest/localização S3 e pins não mudam. Uma comparação recebe explicitamente a equivalência e a célula; não reescreve `VisibleClaim.subjectKey` para passar pelo comparador literal. Para ser comparável, o par exige mesmo predicado admitido, valores conhecidos, moeda/unidade compatível e cobertura temporal conhecida de ambas as claims naquela célula, além de âncoras iguais ou equivalentes. Distinção explícita e identidade não resolvida são motivos diferentes de não comparabilidade. Período/valor desconhecido permanece desconhecido; não se inventa zero, sobreposição ou seleção.

Exemplo: A afirma 100 BRL e B 120 BRL, ambos cobrindo setembro/outubro. A=B em setembro e A≠B em outubro. Uma consulta de 15/09 a 15/10 apresenta ao menos `[15/09,01/10)` com comparação divergente e `[01/10,15/10)` com assuntos distintos, sem um único badge para todo o intervalo. As duas claims continuam mostrando seus períodos originais completos. A explicação informa a célula em que a comparação vale; merge não elege 100 nem 120. Claims de período desconhecido ficam na coleção original e são explicitamente excluídas das comparações temporais verificadas.

`Inspect` D01 continua literal, com DTO público inalterado. A nova leitura privada não altera a observação do viewer, nem usa um Frame de identidade como Frame D01 de correção. `atFrame` retorna exatamente o Frame histórico autorizado, sem recalcular grafo, fontes ou representante atual.

## Shapes candidatos e consentimento

Os nomes e shapes seguintes tornam a proposta revisável; **não são API congelada, endpoints admitidos ou código executável**. Tipos primitivos usam os contratos existentes. `Ref`, digest, cut, representante e consequências são emitidos pelo executor, nunca autoridade escolhida pelo cliente. Datas e pares têm serialização canônica. IDs de célula referenciam a decomposição exata do Frame; a ordem dos arrays é canônica e entra no digest.

```text
InspectSubjectIdentity {
  worldRef, anchors: [subjectKey] | [subjectKey, subjectKey], interval,
  atFrame?: IdentityFrameRef
}
IdentityFrame {
  kind: "subject-identity", frameRef, worldRef, requestedAnchors, interval,
  audience: "private-author", claims: [VisibleClaim original],
  closureAnchors: [subjectKey], assertionSegments: [
    { assertionRef, decisionRef, relation: "same-as" | "different-from",
      left, right, effectiveInterval, withdrawalRefs }
  ],
  cells: [{ cellRef, interval,
    components: [{ representative, members: [subjectKey] }],
    distinctions: [{ leftComponent, rightComponent, assertionRefs }],
    comparisons: [{ leftClaimRef, rightClaimRef,
      status: "agree" | "conflict" | "not-comparable" | "unknown",
      reasons, identitySupportRefs, interval }]
  }]
}
ProposeIdentityResolution { frameRef, left, right, operationId }
ProposeIdentitySplit {
  frameRef, anchor,
  partitionsByCell: [{ cellRef, blocks: [[subjectKey]] }], operationId
}
ProposeIdentityUndo { frameRef, targetDecisionRef, operationId }
IdentityQuestion {
  kind: "identity-resolution" | "identity-split" | "identity-undo",
  questionRef, caseRef, frameRef, interval, consequenceDigest,
  alternatives: [{ answer, effectItems, afterCells, impact }],
  blockedAlternatives: [{ answer, reason, supportingRefs }]
}
ResolveIdentity { questionRef, consequenceDigest, answer, operationId }
EffectItem =
  Assert { relation, left, right, interval }
  | Withdraw { assertionRef, interval }
  | UndoEffect { targetEffectRef }
```

`reasons` é enum fechado a definir no gate de schema: identidade não resolvida, assuntos distintos, predicado diferente, moeda/unidade incompatível, valor desconhecido ou período desconhecido; não texto livre de decisão. `agree/conflict` só existe com todos os requisitos de comparação satisfeitos. `identitySupportRefs` inclui caminhos/asserções necessários e, para distinção, seu suporte; o Frame também contém o fechamento completo, sem depender da escolha de um caminho para guardar a base. Comparações de mesma âncora não exigem aresta positiva. Nenhum status equivale a valor selecionado ou fato aprovado.

O estado privado retido com Frame/Question inclui base versionada completa, fonte/digest/pins, autor/propósito e predicados de presença e ausência do fechamento. Não se exige expor `InternalBasis` na DTO. `afterCells` mostra o estado prospectivo integral do fechamento relevante, com as mesmas regras temporais e de comparação; a união das fronteiras do antes/depois permite comparar os efeitos sem perder subintervalos. `impact` enumera invalidação conservadora de Cases pendentes, preservação de correções literais e Frames históricos, e aplicação a novas claims das mesmas âncoras no intervalo. Nenhuma alternativa vem selecionada.

Uma proposta não altera identidade. O Case congela alternativas permitidas, efeitos exatos e impedimentos. `ResolveIdentity` só aceita uma alternativa exibida no digest e preserva a intenção nos retries. Mesmo `operationId` com intenção diferente retorna `Conflict`; não gerar outro ID automaticamente. `unknown` fecha o Case com resposta auditada, receipt/outbox, sem efeito de identidade e sem apagar relação existente. Um impedimento não é alternativa executável.

### Resolução de igualdade ou diferença

A Question de resolução trata exatamente o par indicado, em **todo o intervalo do Frame**, mas mostra o fechamento transitivo afetado em todas as células. Oferece `same-as`, `different-from` e `unknown` quando viáveis; alternativas impossíveis aparecem bloqueadas com motivo e suporte privado. A viabilidade é avaliada em todas as células. Se apenas parte do intervalo admitir a opção, ela fica bloqueada inteira; nova consulta/proposta com intervalo escolhido pelo humano é necessária.

`same-as` acrescenta asserção positiva direta nos subintervalos ainda não cobertos por uma asserção direta positiva do mesmo par. Isso pode acrescentar uma aresta de ciclo mesmo quando já há igualdade transitiva; a nova declaração e seu undo são efeitos reais. Onde a aresta direta já cobre o período, não duplica efeito. Uma distinção entre os componentes em qualquer célula bloqueia a alternativa (`ConflictingDistinction` candidato); não a retira implicitamente.

`different-from` acrescenta asserção negativa direta onde não existe a mesma asserção direta efetiva. Se os extremos estão no mesmo componente em qualquer célula, a alternativa é bloqueada (`RequiresPartition` candidato), mesmo que exista uma aresta direta fácil de remover. Uma distinção já inferida por substituição não impede registrar uma nova asserção direta; essa redundância tem autoria/undo próprios. Igualdade literal reflexiva não abre Case para criar distinção.

A ausência de delta direto em todo o intervalo é reafirmação auditada, sem avanço do domínio de identidade. Se qualquer item muda o conjunto de asserções efetivas, inclusive aresta de ciclo ou negativa redundante, avança esse domínio, ainda que a partição de equivalência não mude. Uma inconsistência não é corrigida pela resposta `unknown`. Para mudar uma decisão incompatível, o humano examina e confirma undo ou split explícito, depois prepara outra resolução sob nova base.

### Split é partição explícita de todo o componente

O owner escolhe uma âncora e entrega uma partição para **cada célula do Frame**. Em cada célula, os blocos precisam ser não vazios, sem repetição, disjuntos e cobrir exatamente todos os membros do componente positivo daquela âncora. Não podem omitir membro, incluir estranho ou escolher só as sementes. Uma célula pode conservar um bloco único, mas ao menos uma célula precisa ter separação real. Se setembro contém AB e outubro ABC, as partições são enumeradas separadamente; não se reutiliza silenciosamente a lista AB em outubro. Não inferir para onde C deve ir.

A proposta calcula e mostra todos os itens necessários:

1. Retirar, por `Withdraw(assertionRef, intervalo recortado)`, **todas** as asserções positivas efetivas que cruzam blocos na célula, inclusive arestas redundantes e ciclos. Preservar as arestas internas aos blocos. Retirada é evento append-only; não editar o intervalo original da asserção.
2. Acrescentar distinções diretas para todos os pares de âncoras em blocos diferentes naquela célula. Esse conjunto explícito dá significado durável ao split e consome o orçamento de efeitos; não é uma amostra ou apenas uma árvore entre blocos. Intervalos adjacentes do mesmo item podem ser coalescidos canonicamente sem alterar efeito.
3. Recalcular o fechamento prospectivo completo. Seus componentes positivos precisam ser **exatamente os blocos propostos** dentro do componente original, mantendo o restante intacto. Se um bloco proposto não ficar conectado após as retiradas, a proposta é inválida (`InvalidPartition` candidato); o executor não acrescenta igualdade interna que o humano não propôs. A UI pode mostrar a partição viável a partir do grafo, mas não escolher por ele.
4. Verificar ausência de contradição com todas as distinções vigentes e mostrar comparação/representantes após a mudança. Asserções, comparações e componentes fora do intervalo do split permanecem iguais. O Frame histórico conserva o estado anterior.

A Question de split oferece `confirm` e `unknown`, com a partição por célula, cada asserção retirada, subintervalo e nova distinção no digest. “Separar A e B” sem essa partição não é consentimento suficiente para separar C, nem autorização para manter A=B por um caminho alternativo oculto. Confirmar aplica o conjunto inteiro atomicamente.

### Undo é inversão explícita de efeitos, com nova revalidação

Cada decisão aplicada possui itens de efeito imutáveis identificados. `ProposeIdentityUndo` recebe um Frame novo e o ID exato de uma decisão aplicada de resolução ou split, do mesmo autor/World/propósito. O Frame comparativo ou o `IdentityRecoveryFrame` explicitamente distinto precisa cobrir todo o intervalo e fechamento afetados pelo alvo; intervalo menor ou âncoras insuficientes não autorizam undo parcial. A proposta enumera a inversão de **todos** os itens do alvo e o estado prospectivo atual. Não aceita um evento de undo como alvo nem inventa uma cadeia de redo.

A inversão desativa, por novo evento, as asserções criadas pelo alvo e cancela as retiradas pertencentes ao alvo. Não apaga asserções ou máscaras históricas; uma asserção só reaparece onde não houver outra retirada ainda efetiva. O alvo já desfeito, sem efeito de identidade ou cujas asserções adicionadas tenham sido retiradas por decisão posterior retorna `Stale`; não há inversão parcial silenciosa. Outras decisões posteriores podem coexistir, mas sua base e suas consequências entram na nova inspeção.

Undo de A=B em um triângulo A=B, B=C, A=C pode deixar ABC conectado; a Question mostra isso e não chama essa ação de split. Undo de split retira suas distinções e cancela suas retiradas, podendo reunificar o componente. Se a restauração conflitar com outra distinção independente vigente, a proposta fica bloqueada (`ConflictingDistinction`), sem apagar a decisão alheia. A Question de undo oferece `confirm/unknown` e congela a inversão completa. Mudança posterior à Question produz `Stale` na confirmação, mesmo que o alvo ainda exista.

Replay do receipt antigo de merge após split/undo retorna o mesmo resultado histórico após reautorização e não reaplica identidade. Nova leitura fornece estado atual. As explicações conservam a linhagem decisão → itens → retiradas/undo e nunca confundem “desfazer esta declaração” com “garantir que estes assuntos agora sejam diferentes”.

## Commit, guards e migração histórica

Todos os passos usam o mesmo executor e `commitMutation` SERIALIZABLE, locks em ordem comum, identidade de operação por principal/World/operação, reautorização anterior ao replay, receipt e outbox atômicos. Mantém-se o limite atual de três tentativas totais para serialização/deadlock. Retry não recalcula consentimento nem muda alternativas. Não há rede/modelo dentro do cálculo transacional de identidade.

A base captura fontes/claims de todo o fechamento, presença/membership, head, todos os domínios vigentes e a dependência de identidade. Deve proteger também a **ausência** de arestas que expandiriam ou contradiriam o fechamento, inclusive nova terceira aresta concorrente. Guardar somente IDs de asserções encontradas é insuficiente. O guard completo de revisão mais predicados versionados deve impedir phantom; sua implementação/locks exigem prova concorrente, não mera declaração no documento.

Recomenda-se novo domínio explícito de identidade e nova versão privada de `InternalBasis`/dependências. Todo Frame novo, inclusive `Inspect` literal D01, recebe internamente o cut completo com os cinco domínios atuais mais identidade; o DTO público D01 não muda. Uma decisão com algum efeito de identidade avança identidade uma vez; criar/resolver Case avança `cases`. Reafirmação/unknown conserva auditoria sem avanço de identidade. O único ajuste permitido na base da própria Question é o avanço de `cases` causado pela própria proposta, como no fluxo atual; não atualizar fonte, head, membership, identidade ou consequências.

**A compatibilidade é pré-condição da DDL e abrange todos os atos novos, inclusive correções literais existentes:**

- Bases privadas antigas de cinco domínios permanecem byte a byte intactas, assim como Frames, Questions, receipts, digests e fontes. Não preencher `identities: 0`, recalcular read set ou regravar base antiga.
- Decoder versionado reconhece e preserva a versão antiga para leitura histórica. Qualquer **novo ato dependente de base antiga**, incluindo propor/responder/desfazer correção literal D01, retorna `Stale` após verificar replay autorizado. Isso exige uma nova inspeção com base completa. Não limitar esse guard à nova família de identidade, nem transformar versão antiga em `Unavailable` permanente.
- Operação já registrada é reautorizada e replayada exatamente **antes** da rejeição da base antiga por obsolescência. Se handlers carregam Frame/Case antes do caminho atual de replay, precisam manter decodificação histórica e evitar validar a base como ato novo nesse trecho. ID igual com intenção diferente continua `Conflict`.
- `atFrame` e leitura histórica autorizada preservam DTO/explicação antiga, sem usar cut atual para recalcular resultado. Uma base antiga legível não se torna base válida para ato novo por isso.
- Antes da migração, inventariar todos os entrypoints de leitura, proposta, resposta, undo e replay legados; demonstrar a ordem autorização → replay/identidade de intenção → compatibilidade/guards de novo ato. Só depois estender persistência e emitir novas bases. Uma função decoder isolada não fecha essa obrigação.

Não reutilizar silenciosamente `ReadSet.identities` reservado e rejeitado pelos guards atuais. Se o integrador preferir outro mecanismo/domínio, precisa voltar à revisão com prova equivalente para todos os writers/readers, ausência concorrente e histórico; não é exceção tácita a esse contrato.

## Fechamento de impacto atual

O grafo é projeção de eventos no cut; não muda `claims.subject_key`, S3, fontes ou registros. Leituras novas recalculam equivalência/comparação por célula. Frames salvos mantêm seus membros, representante, escopo, pins e explicação. Mudança efetiva de asserções invalida conservadoramente Cases pendentes de identidade e correção pelo cut completo, inclusive quando uma aresta redundante não muda componentes.

Correções já aplicadas conservam autor, assunto literal e intervalo. Não são herdadas de A em B durante merge, migradas no split ou apagadas no undo. A leitura privada pode apresentá-las por âncora; continuam anotações, sem alterar resultado automático das fontes. Corrigir um resumo combinado permanece fora deste incremento.

Purchase Cases, Watches e datasets derivados ainda ausentes não recebem tabelas vazias ou atribuição heurística. Cada futuro consumidor precisa registrar dependência de identidade e provar invalidação/estado não resolvido quando a atribuição ficar ambígua. Este incremento não conclui esse impacto futuro, stewardship compartilhado ou C024/C025 completos.

## Contraprovas propostas antes de implementação

São oráculos candidatos, **não testes executados**. Funções puras recebem entradas sintéticas diretas; efeitos usam PostgreSQL/S3/Better Auth reais, papéis normais e o executor comum. Preservar falha reproduzível e revisão independente; build/análise estática não substituem integração, migração, concorrência ou navegador.

| ID | Testemunha necessária |
| --- | --- |
| ID-01 — fontes | Importar JSON/CSV atuais; registrar bytes/digests/refs/chaves/pins. Merge/split/undo preservam fontes e `OpenEvidence` byte a byte. |
| ID-02 — transitividade | A=B e B=C tornam A=C no mesmo período, sem reescrever claims. Representante determinístico independe de ordem e orientação das arestas. A≠C impede a união; A≠B/B≠C não infere A≠C. |
| ID-03 — tempo | Consulta 15/09–15/10 atravessa igualdade em setembro e diferença em outubro: células e comparações distintas, períodos originais intactos. Sobreposição parcial, fronteira exclusiva e claims de período desconhecido não ganham badge global. |
| ID-04 — comparação | A=100/B=120 só conflitam em célula com igualdade, predicado/moeda/tempo compatíveis. Sem relação, distintos, moeda incompatível ou suporte desconhecido têm motivos próprios; merge não seleciona verdade. |
| ID-05 — ambiguidade | Nomes parecidos não criam aresta. Alternativas/deltas/impedimentos exatos são exibidos. `unknown` não é diferença e não remove declaração. Alternativa viável em parte do período fica bloqueada inteira. |
| ID-06 — split e ciclos | Triângulo ABC: remover só AB não divide; split A | BC retira AB e AC, mantém BC e acrescenta distinções completas. Bloco desconectado é recusado. AB em setembro/ABC em outubro exige partições completas separadas. Fora do intervalo permanece igual. |
| ID-07 — undo | Undo de AB no triângulo mantém ABC por outro caminho e explica isso. Undo de split pode reunir; negativa independente que tornaria a restauração contraditória bloqueia. Alvo já desfeito ou asserção retirada depois fica `Stale`; sem inversão parcial. |
| ID-08 — concorrência | Preparar A=B e B=C/A≠C sob bases compatíveis e intercalar confirmações reais. Nova aresta/ausência alterada produz `Stale`; nunca grafo contraditório. Fonte/membership/correção concorrente também invalida o cut completo. |
| ID-09 — história | Merge → split → replay merge devolve receipt original sem reassociar. Mesmo opID/intenção diferente conflita. Frames antigos não ganham membros ou fontes atuais. |
| ID-10 — audiência | Viewer/terceiro não abre novo Frame/Case/receipt com ID conhecido. Duas bases diferindo só por declarações privadas produzem observação literal permitida igual, incluindo contagens/ordem/headers/erros. Revogação vencedora impede divulgação preparada. |
| ID-11 — impacto | Case literal pendente fica `Stale` após mudança de identidade; correção aplicada não é herdada/movida. Criação do próprio Case permite sua resposta imediata sem concorrência. |
| ID-12 — limites | Fechamento com cadeia positiva/negativa, segmento após retirada, excesso de células/pares/efeitos: falha inteira sem Frame/Question parcial. Dados privados alheios não influenciam quotas. Estado prospectivo também cabe ou nada é aplicado. |
| ID-13 — atomicidade | SIGKILL em limites reais: decisão/itens/Case/revisões/operação/receipt/outbox todos ou nenhum. Reinício com bytes/opID iguais produz um resultado; sem promessa de ACID distribuído com S3/auth. |
| ID-14 — compatibilidade | Banco com histórico real de cinco domínios: antigos Frames leem e operações replayam; todos os atos novos com base antiga, inclusive correções literais, ficam `Stale`. Nova inspeção recebe base completa sem mudar DTO D01; linhas/digests antigos intactos. |
| ID-15 — superfícies | Web/CLI usam mesma Question/digest/opID, mostram células, fechamento, partição inteira e inversão real; `Stale` exige nova inspeção/consentimento. Cliente normal não escreve autoridade direto. |

O cenário histórico de paciente oculto orienta não interferência, mas não admite dados clínicos neste perfil. A testemunha local usa assuntos não sensíveis e principals/Worlds reais; ACL distinta por fonte continua fora do modelo atual.

## Consumidores e gates para pacote futuro

| Consumidor | Integração necessária |
| --- | --- |
| Contratos / `ApplicationApi` | Família fechada, discriminantes de Frame/Question, enums/erros e limites ratificados. Shapes acima precisam virar schema revisado antes de API. |
| Executor / guards | Dispatch real, autorização derivada da operação, base versionada completa, fechamento/ausência, commit/replay/fence comuns. |
| Persistência | Decisões/itens/retiradas/undo privados, linhagem e versões; projeção temporal e constraints coerentes. Compatibilidade legada antes de DDL. |
| Leitura / comparação | Snapshot único, fechamento completo, células, fontes preservadas, comparação por equivalência explícita. Função não utilizada não entrega capacidade. |
| Correção atual | Todos os guards/decoders/replays reconhecem versões e invalidam atos novos antigos; não aceitam Frame combinado. |
| Web / CLI | Inspecionar fontes/fechamento → resolver Question → nova leitura → particionar ou propor undo → confirmar consequência exata. |
| Prova independente | Leis, integração, concorrência, migração, crash, divulgação e journey reais; artefatos de falha preservados. |

Antes de atribuir EX24, ratificar: **(1)** audiência privada; **(2)** âncoras existentes sem fuzzy; **(3)** G transitivo com negativas e fechamento completo; **(4)** células temporais e comparação sem badge global; **(5)** resolução, split por partição e undo de efeitos; **(6)** shapes/digests/enums/rotas candidatos; **(7)** limites numéricos, erros e inspeção de recuperação distinta para excesso de claims; **(8)** domínio/versionamento e auditoria de todos os entrypoints legados antes da DDL; **(9)** impacto em correções/consumidores e exclusões futuras; **(10)** owners, write allowlists, locks, migração e oráculos de cada segmento.

Este documento permanece candidato, sem EX24, migração, API congelada ou autorização para produção. Outra audiência, identidade entre Worlds ou atribuição de derivados exige revisão própria; não decorre de escolher transitividade correta.
