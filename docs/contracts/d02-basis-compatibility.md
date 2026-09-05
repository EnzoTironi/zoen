# EX25 — auditoria documental de compatibilidade de bases

Auditoria independente W2, 2026-09-05, sobre código em `06535bdcec668f62ba6d91d8ebb17e0235ed568b` do checkout `/Users/enzotironi/zoen-rebuild`. Documento preparado antes de congelar a nova versão privada. Não autoriza DDL, código, novas operações ou alteração do digest legado. A atribuição do integrador limita esta escrita a este arquivo.

A decisão de produto examinada é D02 G com recuperação estrutural distinta, candidato `c2d2b70`, mais a precisão do integrador sobre o limite de 1.048.576 bytes. A revisão anterior está em [d02-subject-identity.review.md](d02-subject-identity.review.md). Este inventário é evidência de leitura do código atual; os oráculos abaixo ainda não foram executados.

## Decisão de representação ratificada por root para EX25

`LegacyInternalBasis` e `LegacyReadSet` conservam exatamente os schemas antigos sem discriminante. `CurrentInternalBasis` acrescenta `schemaVersion: "authority.basis.v2"`; `CurrentReadSet` acrescenta `schemaVersion: "authority.read-set.v2"`. O cut atual inclui o domínio `identity`. O decoder de histórico `InternalBasis` aceita a união exata das duas versões; `ReadSet` e `DomainCut` usados para novas escritas são os atuais. Nenhum decoder promove legado ou inventa revisão ausente.

O algoritmo `structuredDigest("read-set", ...)` e seu prefixo permanecem intactos. O discriminante explícito do read set atual entra no JSON canônico e, portanto, no digest novo. Literal atual mantém `identities: []`; a família de identidade registra dependências `SubjectIdentityGraph` com principalRef, purpose, anchors, closureAnchors, interval e revision. World está vinculado na base. A validação confere escopo contra contexto verificado e revision contra cut.identity; a disciplina comum de writers do domínio protege também ausência/phantoms. Essas dependências não são fornecidas como autoridade pelo cliente.

O guard de versão para ato novo vem depois do replay reautorizado. Os três handlers de correção antecipam a consulta de replay e conservam a repetição sob os locks do commit. O loader histórico continua estrito; corrupção não se torna automaticamente Stale. A migração numerada, fixtures, genesis/provisionamento e ativação são coordenados com root. Provas de dados/guards na camada de componente não autorizam trocar o release vinculado de um World nem qualificam upgrade de uma instalação anterior.

## Conclusão e risco principal

A extensão do cut não pode ser feita substituindo o schema atual por um schema que aceite apenas seis domínios. `loadCorrectionFrame` e `readCorrectionCase` decodificam `InternalBasis` antes de os handlers chegarem ao replay. Essa troca converteria históricos válidos em `Unavailable` e impediria devolver receipts já existentes. Precisam coexistir reconhecimento histórico fiel e validação de base para um ato novo, que são decisões distintas.

A ordem exigida para mutações com operação já registrada é autorização atual → comparação da intenção → replay histórico exato. Para atos novos dependentes de base legada válida, a compatibilidade retorna `Stale` antes de aplicar efeito. Não preencher domínio de identidade em linhas antigas, não recalcular read set ou consequência, não reinterpretar um Frame histórico como uma inspeção atual.

## Representações e persistência atuais

| Ponto | Estado observado | Obrigação de compatibilidade |
| --- | --- | --- |
| `ports/d01/basis.ts` | `DomainKey` fecha membership, sources, evidence, claims e cases. `DomainCut` e `InternalBasis` são schemas exatos, sem discriminante de versão. | Reconhecer a forma legada intacta e uma forma nova explicitamente congelada; não depender de coerção/exclusão de campos. |
| `ReadSet` | Tem clockSample, identities, membershipRevision, predicates, sources e temporalGuards. PredicateDependency usa claims/obligation.amount/subjectKey/version. | Manter o significado e o digest do legado. O array identities reservado não é suporte já implementado. |
| `validateBasis` | Rejeita identities não vazio; compara digest, World, head, membership, todos os cinco domínios e versões dos predicados, depois fontes e tempo. | Nova validação exige identidade e ausência reais, sem retirar guards antigos. Base legada válida de ato novo retorna Stale. |
| `values/canonical.ts` | `structuredDigest` usa prefixo `zoen:d01:read-set:v1\n`; consequência usa domínio correction-consequence. CanonicalJson preserva strings e ordena chaves UTF-16. | Congelar como a versão nova vincula seu significado; qualquer novo discriminante/domínio não altera bytes nem prefixo de objetos legados. |
| `authority.frames` | Retém internal_basis e visible_frame JSONB, principal/purpose/assunto e pins. | Preservar JSON/campos/digests/pins históricos; JSONB não é promessa de preservar whitespace original de um JSON recebido. Comparar representação canônica e valores retidos. |
| `authority.cases` | Retém internal_basis, question, consequence, Frame e state. | Preservar base, pergunta, digest e consequência. Não promover Cases pendentes antigos para versão nova. |
| `authority.receipts` | Retém result e touched_domains. `readReceipt` seleciona somente result. | Receipt antigo não precisa de preenchimento de cut para ser replayado. Não passar a exigir novo DomainCut no reader histórico. |
| `ops/migrations/001_d01_authority.sql` | CHECK de domain_key enumera cinco nomes. | Registrar dependência do futuro plano DDL, sem editar migração histórica. |
| `commit/genesis.ts` | initialCut contém cinco zeros e cria as respectivas linhas em authority.domains. | Novos Worlds precisam da forma nova real; Worlds existentes precisam de transição explícita aprovada. Isso não autoriza acrescentar zero a uma base salva. |

`readCut` lê todas as linhas do World, decodifica cada domain_key e depois o registro exato. Acrescentar uma linha identidade ao banco enquanto esse reader antigo continua ativo gera `Unavailable`, não compatibilidade. Acrescentar o schema novo sem criar a linha real também falha. Portanto rollout, migração e leitores/escritores precisam de ordem coordenada; não há fallback que invente estado ausente.

## Ordem exata dos entrypoints atuais

Os caminhos abaixo começam depois da entrada no executor comum. `semantic/executor.ts` faz parse da família → Presence.verify → deadline/contexto validado → dispatch. Depois do handler, decodifica o sucesso, serializa canonicalJson, verifica responseBytes e prepara divulgação. A revalidação de Presence/World e o fence de divulgação continuam obrigatórios antes da emissão. Compatibilidade não substitui essa fronteira.

### Inspect atual

`knowledge/d01/inspect.ts`:

1. Decodifica Inspect; abre transação REPEATABLE READ; autoriza read no World; confere instalação/cell/head admissível.
2. Com atFrame: seleciona **somente visible_frame**, filtrando World/realm/Frame/principal/purpose/subjectKey; decodifica VisibleFrame; confere referências e devolve o payload salvo. Não lê InternalBasis, readCut ou claims atuais nesse ramo.
3. Sem atFrame: lê cut atual; claims literais; classificação; correções do principal (viewer recebe lista vazia); amostra de relógio; dependências de fontes; ReadSet com identities vazio e predicate.version=cut.claims.
4. Constrói InternalBasis e seu digest; serializa base e visible; insere Frame e pins na mesma transação; valida contexto/deadline.
5. Fora da transação, reautoriza read e embrulha FrameInspected; segue emissão comum.

Plano: ramo histórico permanece histórico e com DTO D01 inalterado. Ramo atual emite somente a versão privada nova completa após cut real estar disponível. Novo Frame deve ser identificado como literal para não alimentar acidentalmente consentimento de identidade. Um Frame novo não pode obter identidade faltante por coerção do decoder.

### ProposeCorrection atual

`knowledge/corrections/propose.ts`:

1. Decodifica request.
2. `loadCorrectionFrame`: autoriza World; busca Frame próprio por purpose; decodifica **InternalBasis + VisibleFrame**; valida referências. SchemaError vira Unavailable.
3. Valida escopo literal/claim/intervalo; calcula consequenceDigest; gera IDs e StoredQuestion.
4. Faz bindWorldIntent e chama commitMutation com base salva e todos DomainKey.literals.
5. Só em apply: avança cases da base pela própria proposta, mantendo todo resto/read set; canonicaliza base/question/consequence; insere Case e seus pins; retorna CorrectionProposed.

Risco: o loader, o escopo e a preparação antecedem replay. O decoder histórico deve continuar aceitando o Frame original; a rejeição por versão não pode ocorrer ali. Recomenda-se antecipar consulta de replay autorizado após request/bind e antes desses carregamentos dependentes de estado, mantendo a repetição dentro de commitMutation para concorrência. Não há autorização para dispensar guard do ato novo.

### AnswerQuestion atual

`knowledge/corrections/answer.ts`:

1. Decodifica request; autoriza World.
2. `readCorrectionCase` busca Case por World/realm/question/principal e decodifica **InternalBasis**, consequence, question, state, frame_id e subject. Confere coerência questionRef/subject. Esse reader não autoriza por si; o caller já autorizou.
3. Faz bindWorldIntent, gera correctionRef e chama commitMutation com base salva e todos os domínios.
4. Só em apply, relê Case; recalcula consequenceDigest; exige proposed, digest retido igual ao pedido e resposta permitida; lê correções efetivas; encontra anterior no intervalo exato; insere Answer e marca Case applied.

Plano: request de replay deve alcançar intenção/receipt antes da obsolescência da base. Nova resposta de Case legado retorna Stale, mesmo se a Question ainda estiver proposed e nenhuma fonte tiver mudado. Não recalcular a consequência do Case para torná-la atual. Para Case novo, releitura transacional e validação do consentimento continuam obrigatórias.

### UndoCorrection atual

`knowledge/corrections/undo.ts`:

1. Decodifica request; carrega Frame próprio pelo mesmo loader de ProposeCorrection.
2. Exige correctionRef na lista scopedCorrections do Frame salvo; caso contrário NotFoundOrDenied.
3. Faz bindWorldIntent, gera novo correctionRef e chama commitMutation com base salva e todos os domínios.
4. Só em apply, lê projeção atual do assunto literal; exige que o alvo ainda esteja ativo; busca Case do alvo sob principal; insere evento Undo ligado ao alvo, sem apagá-lo.

Plano: uma operação histórica já aplicada não precisa que sua base se torne atual novamente. Replay reautorizado precede guard de versão. Um **novo** undo baseado no Frame antigo retorna Stale e exige inspeção nova. A nova inspeção ainda pode permitir desfazer uma correção historicamente aplicada, conforme os guards e escopo atuais; versão do evento alvo não é motivo para reescrever esse evento.

### commitMutation e replay atual

`commit/mutation.ts`:

1. Antes da transação: confere digest do request/bound; decodifica domínios; remove duplicados e ordena locks; gera receiptRef.
2. SERIALIZABLE: World FOR SHARE; authorizeMutation (World/capability + instalação); lock de identidade da operação; locks FOR UPDATE dos domínios declarados; membership FOR SHARE; authorizeWorld novamente.
3. `readMutationReplay`: authorizeMutation; recomputa/confere bound.digest; procura operations por World/realm/principal/operação/opID; se existe, compara intenção; lê receipt do mesmo principal/operação; reautoriza. Retorna receipt exato ou null.
4. Só sem replay: readCut; validateBasis se não null; insere operations; executa apply; exige changedDomains contido nos locks; avança cada domínio afetado uma vez; reautoriza; persiste receipt + outbox; valida contexto.
5. Commit/retry SERIALIZABLE comum; reautoriza fora da transação; retorna resultado para executor/fence.

O guard de compatibilidade para **novo ato** pertence depois do ramo de replay e antes de apply. A eventual consulta antecipada de replay no handler não substitui a consulta sob locks. A identidade da operação e o domínio de digest legado não podem mudar para facilitar migração. Intenção diferente sob mesmo opID continua Conflict; request malformado continua sujeito ao parse público anterior.

`validateBasis` atual primeiro decodifica, recalcula digest read-set e compara World/head/cut/membership/predicados/identities. Depois busca cada evidência admitida e compara sourceRef/revisão/digest; por fim usa clock_timestamp e incerteza para verificar janelas. A versão nova deve conservar essa ordem lógica de validação e incluir fechamento/ausência, sem promover legado em memória.

## Outros consumidores que não podem ser esquecidos

| Entry point | Particularidade observada | Gate |
| --- | --- | --- |
| CreatePersonalWorld | Bootstrap replay próprio: contexto/lock → lookup bootstrap → autoriza World existente → requireSameIntent → readReceipt. Novos Worlds persistem initialCut. | Provar bootstrap replay legado e genesis novo; não impor base salva onde ela não existe. |
| ImportEvidence | Policy/parse/bind → reserveCapture/stageCapture → commitMutation, basis null, domains claims/evidence/sources. | Cut/receipt novo precisa ser compatível. O replay atual ocorre depois da preparação de captura; não prometer que EX25 remove esse trabalho externo. Não aplicar Stale-legado universal a toda operação basis:null. |
| Grant/RevokeWorldReadAccess | Autoriza manage → bind → readMutationReplay antecipado; só depois resolve alvo/diretório e chama commitMutation, basis null, domain membership. | Preservar replay antecipado e transacional; não vincular permissões de viewer à identidade privada. |
| readReceipt | Decodifica StoredOperationResult e confere tag/receipt/World quando presente; não decodifica touched_domains. | Versão nova não deve quebrar DTOs históricos nem reinterpretar cut antigo. |
| readScopedCorrections | Projeção literal e privada de eventos; consultada por Inspect/answer/undo. | Correções aplicadas permanecem no assunto original. Identidade invalida base pendente, sem mover projeção. |

## Plano de compatibilidade antes de qualquer DDL

1. Congelar explicitamente a nova forma privada, distinção de versão, domínio de identidade, leitura de ausência e regra de digest. A forma legada sem discriminante deve ser reconhecida exatamente, sem inferência baseada em IDs arbitrários e sem cast que a transforme na nova.
2. Separar tipo/decoder de histórico retido do tipo de base admissível para nova mutação. Legado válido continua legível; corrupção/malformed não é tratada automaticamente como Stale nem recebe dados inventados.
3. Garantir autorização e identidade de intenção antes do replay, inclusive nos três handlers de correção. Testar carregamentos anteriores ao commit: uma prova apenas de validateBasis não cobre esses caminhos.
4. Emitir novas bases somente com cut completo obtido do banco e dependências reais. A própria proposta pode ajustar exclusivamente seu avanço de cases conhecido, preservando versão, read set, head, identidade, fontes e consequência.
5. Preparar a transição de domínio/Worlds/initialCut/check de persistência em pacote posterior autorizado. Reader antigo não pode permanecer escrevendo durante uma transição incompatível sem um protocolo explicitamente provado. Esta auditoria não escolhe downtime ou rollout automático.
6. Preservar linhas antigas: bases, Frames, Cases/Questions, digests, receipts/touched_domains, pins e eventos. Não preencher identidade=0, recalcular histórico ou alterar expected fixtures para ocultar incompatibilidade.
7. Só depois da prova de migração e ordem dos entrypoints habilitar emissão de novas bases e implementação de identidade nos pacotes atribuídos. Uma compilação isolada não prova essa compatibilidade.

## Oráculos necessários, ainda não executados

| ID | Evidência que precisa existir |
| --- | --- |
| BC-01 | Histórico real pré-transição: World, imports JSON/CSV, Frame, proposta pendente, correção aplicada e undo/receipts. Registrar valores JSON canônicos/digests antes da mudança; não fabricar base antiga já na versão nova. |
| BC-02 | Após transição, atFrame devolve exatamente o payload antigo autorizado; fontes/refs/pins/correções literais intactos. |
| BC-03 | Replay exato de ProposeCorrection, AnswerQuestion e UndoCorrection legados devolve receipt original sem efeito novo, apesar do cut obsoleto. |
| BC-04 | Mesmo opID com intenção diferente dá Conflict; terceiro/revogação/logout impede replay antes de divulgar resultado. |
| BC-05 | Novos opIDs com base/Question antiga válida dão Stale em todos os três handlers, sem Case/evento/receipt/outbox novo. Diferenciar erro de versão de corrupção em teste puro da fronteira apropriada. |
| BC-06 | Nova inspeção cria base completa; proposta/resposta imediata funciona ajustando só cases da própria proposta. Alteração concorrente de identidade, incluindo aresta redundante/ausência, invalida Case literal novo. |
| BC-07 | Bootstrap replay, import replay e grant/revoke replay antigos continuam na mesma identidade de operação; novos writes basis:null produzem cut/receipt novo sem exigir Frame. |
| BC-08 | Falha real durante migração/ativação não expõe parcialmente leitor novo contra domínio ausente; preservar dados e evidência de rollback/recovery conforme pacote aprovado. |
| BC-09 | Web/CLI pelo executor mantêm DTO literal; resultado preparado é barrado por revogação vencedora no fence; testes de decoder não substituem isso. |

## Precisão independente sobre bytes e recuperação

A regra proposta pelo integrador — verificar a resposta completa antes de persistir Frame/Case e preservar a projeção estrutural prospectiva dentro de responseBytes — cobre Q1 de crescimento **somente de claims** se todos os campos de recuperação, inclusive impacto e metadados, independem desse inventário. Uma coleção estrutural completa não pode ganhar listas comparativas, refs de todas as claims ou resumos variáveis escondidos em outro campo.

Duas precisões são necessárias:

- O limite é de bytes UTF-8 do DTO completo já serializado, incluindo envelope e alternativas, não quantidade de caracteres nem um componente isolado. Frame de recuperação que cabe não prova que a Question cabe: antes/depois, partições e effectItems podem duplicar conteúdo. Para garantir uma jornada de reversão, os writers precisam preservar a serializabilidade da Question necessária, ou um orçamento conservador demonstrado que implique isso. Caso contrário se garante apenas inspeção e a confirmação pode continuar impossível.
- O serializador efetivamente usado é `canonicalJson`. Além de envelopeBytes=1.048.576, ele impõe **entries=10.000 e depth=32**; responseBytes também é 1.048.576. Portanto validar somente bytes não basta. A invariância prospectiva deve usar a mesma serialização completa de Frame e Question (ou uma prova conservadora para todos esses limites), sem aumentar limites, truncar ou trocar serializador para passar.

Hoje Inspect serializa visible antes do INSERT, mas FrameInspected é embrulhado depois; persistReceipt serializa result dentro do commit; a emissão serializa/limita novamente depois que o handler concluiu. Essa ordem não prova ausência de Frame/Case persistido para uma resposta final que exceda limite. O pacote futuro deve verificar o resultado completo antes de persistir os novos objetos/efeitos; o check final do executor continua uma defesa adicional, não a prova transacional.

Oráculo adicional: grafo com chaves/linhagem e múltiplas células perto dos limites, ainda abaixo das quotas numéricas, que caiba como Frame mas ultrapasse bytes ou entries na Question. A proposta inteira deve falhar sem Case parcial; os writers não podem admitir estado que viole a garantia de recuperação escolhida. Depois, imports reais que alteram somente claims devem conservar exatamente o orçamento estrutural e permitir a recuperação contratada. Nenhum benchmark, teste de bytes ou teste de migração foi executado nesta auditoria documental.

## Implementação candidata EX25 — 2026-09-05

A worktree isolada `codex/ex25-basis-v2`, iniciada em `aaa30db2aeac2e4b6abf96569f6efca236147c69`, implementa os schemas privados ratificados, o cut atual com identity, emissão v2 em Inspect/genesis, dependência estrutural privada canônica e validação contra principal/purpose/revisão. O prefixo de structuredDigest não foi alterado. Loaders históricos continuam usando a união retida; não houve reescrita de persistência histórica.

Os três handlers de correção agora verificam replay reautorizado antes de carregar Frame/Case e mantêm a verificação transacional. Scope da proposta e visibilidade do alvo de undo foram deslocados para apply, depois de replay/validateBasis: isso evita um erro de escopo de um novo ato prevalecer sobre Stale de uma base legada válida. O cálculo usa o mesmo Frame e request imutáveis; não reinspeciona fontes nem renova consentimento durante retry.

Evidência executada nesta etapa:

- Antes da alteração de schemas, a testemunha sintética `basis.EX25.test.ts` produziu 3 falhas/1 passagem: nova versão recusada, sexto domínio recusado e read set legado indevidamente aceito como escrita atual. Falhas preservadas nesta descrição; essa testemunha não substitui o histórico real BC-01.
- Depois: 17 testes focados passaram (10 EX25, 2 temporais EX05 e 5 contratos privados EX02). O digest legado foi conferido contra SHA-256 calculado independentemente do JSON canônico e prefixo antigos.
- Suite unitária completa deste checkout: 28 arquivos, 208 testes passaram. Build de contratos/autoridade passou. Lint das fontes/testes alterados passou após correções de estilo/tipos, sem supressões.
- Typecheck global inicialmente apontou, além de erros locais já corrigidos, os fixtures fora da allowlist `apps/server/test/adapters/postgres/d01/seed.ts` e `tests/integration/d01/commit/guards.EX05.integration.test.ts`. Root coordena seus ajustes; o seed histórico deve usar LegacyDomainCut, sem inventar identidade no histórico.

Não foram executadas migração, integração de banco novo, BC-01–09 ou journey de identidade nesta etapa. O baseline real anterior está sendo preparado independentemente por W3; DDL007, fixtures, perfil e composição são do integrador. Estes testes puros e build não aceitam EX25 nem D02 completos.
