# Revisão independente — candidato D02 de identidade

Revisor: W2. Data: 2026-09-05. Candidato examinado: `78ae058`, arquivo `docs/contracts/subject-identity.md` no checkout `/Users/enzotironi/zoen-subject-identity-contract`. Revisão documental e análise dos consumidores reais; não há implementação D02, execução de oráculos de identidade, aceitação de C024/C025 ou autorização de EX24 neste relatório.

## Resultado

A revisão G resolve as lacunas anteriores de transitividade, consultas entre regimes temporais e bases legadas. Em `78ae058`, foi encontrado um bloqueio de prontidão antes do pacote de implementação: novas claims admitidas por outras operações podem exceder as quotas da leitura necessária para desfazer identidade. O candidato precisa fechar essa transição, incluindo seus efeitos nos writers existentes, ou definir uma recuperação completa revisável. A frase geral de não gravar estado acima da quota não especificava sua aplicação aos imports atuais. A revisão posterior `4040ad6` oferece uma recuperação estrutural distinta e resolve a contraprova no nível contratual, condicionada à ratificação explícita do novo tipo/journey; a avaliação detalhada está no fim deste relatório. Nenhuma prova de implementação foi produzida.

## Q1 — importação posterior pode tornar a decisão impossível de desfazer

Referências no candidato: linhas 43 (novas claims participam da relação), 49–55 (Frame completo e quotas), seção Undo (Frame novo cobrindo todo intervalo e fechamento do alvo), e tabela final de consumidores, que ainda não atribui essa preservação ao importador.

Contraprova lógica concreta:

1. A e B têm uma claim conhecida cada, no mesmo intervalo de setembro, mesmo predicado e moeda. O owner confirma A=B. O fechamento e seu Frame cabem em todos os limites.
2. Imports literais posteriores adicionam claims legítimas, de fontes distintas, até haver 12 claims para A e 12 para B naquele mesmo intervalo. Cada leitura literal continua abaixo de 200 claims. A declaração continua aplicável às novas claims, conforme o próprio candidato.
3. A leitura combinada precisa examinar 24 × 23 / 2 = 276 pares na célula, acima de 256. Deve retornar QuotaExceeded, sem Frame parcial.
4. ProposeIdentityUndo exige um Frame novo completo. Um Frame anterior tem base obsoleta; um intervalo menor não cobre todo o alvo. Split também exige um Frame completo. Logo a associação permanece vigente sem caminho de reversão descrito pelo contrato.

O mesmo problema existe com mais de 200 claims no fechamento ou novas fronteiras que excedam 64 células. Claims de período desconhecido não podem ser descartadas para criar artificialmente um intervalo que caiba. A evidência sintética acima é uma contraprova documental, não um teste executado no produto ausente.

O pacote precisa escolher explicitamente uma solução e seu escopo. Uma possibilidade é preservar a capacidade de revisão/undo em toda admissão que altere claims, com validação prospectiva completa e concorrência no executor de importação; isso muda o comportamento de ImportEvidence e exige autoridade, integração e oráculos próprios. Outra possibilidade exige um contrato de recuperação completo e limitado que não dependa da leitura indisponível. O revisor não autoriza uma operação nova por listar alternativas. Não são soluções: truncar claims, omitir pares, usar base histórica como atual, saltar consentimento, desativar uma relação em silêncio ou aumentar um número sem provar que todos os writers preservam a propriedade.

Oráculo futuro necessário: preparar identidade dentro das quotas; tentar a importação que ultrapassa o limite e intercalar import/merge reais sob PostgreSQL; verificar a decisão escolhida, atomicidade dos efeitos e persistência de um caminho de reversão autorizado. A evidência deve incluir JSON e CSV se ambos podem admitir as mesmas claims. Quota derivada de interpretação privada não pode alterar observação de um principal que não tem direito a ela.

## Pontos resolvidos no candidato G

| Contraprova | Tratamento documental em 78ae058 |
| --- | --- |
| A=B e B=C, com ou sem A≠C | Fecho transitivo real; negativa interna bloqueia commit. Distinção não é transitiva. |
| Caminho alternativo e triângulo ABC | Undo de AB pode conservar igualdade; split A / BC retira AB e AC, preserva BC e explicita as distinções. |
| Setembro AB, outubro ABC | Partição por célula cobre cada componente inteiro; omitir C não é consentimento. |
| A=B em setembro, A≠B em outubro | Células explícitas, comparação recortada e períodos originais intactos; sem badge global. |
| Fonte A muda de identidade | Chave literal, valor, origem, bytes, pins e verification não são reescritos. |
| Correção literal de A e merge A/B | Correção aplicada não é herdada por B; Cases pendentes ficam Stale após mudança efetiva, inclusive aresta redundante. |
| Base antiga de cinco domínios | Atos novos legados ficam Stale, inclusive correções; decoder histórico preserva replay autorizado antes dessa rejeição. |
| Ausência de terceira aresta no momento da proposta | Dependência completa, inclusive ausência/phantoms; ainda requer prova de implementação concorrente. |
| Declaração privada e viewer D03 | Leitura literal permanece separada; autorização antes de fechamento/quota/replay e fence antes de divulgação. |
| Split seguido de replay de merge | Receipt histórico exato não reaplica identidade; nova leitura deve mostrar o estado atual. |

Esses itens são coerência contratual examinada independentemente, não resultados de testes executados. Não permitem declarar C024/C025 completos: ACL distinta por fonte, stewardship compartilhado e os consumidores derivados ainda ausentes permanecem fora do incremento.

## Precisões necessárias no gate de schema

A regra de decomposição deve escolher uma forma canônica única de retenção ou coalescência de fronteiras. O texto exige determinismo, mas permite reunir células equivalentes ou preservar uma fronteira redundante; schema/algoritmo precisa fixar a opção para que cellRef, partição e digest não dependam de escolhas locais. Isso é uma precisão do gate já previsto, não licença para remodelar a temporalidade.

Os identificadores de itens imutáveis usados por UndoEffect precisam estar vinculados às consequências retidas e ao digest; os shapes candidatos mostram targetEffectRef, mas não devem deixar esse ID surgir apenas no cliente. O texto já atribui referências ao executor e pede schemas revisados; a implementação deve demonstrar essa composição.

## Consumidores realmente examinados

Foram lidos `ports/worlds/basis.ts`, `commit/guards.ts`, `knowledge/worlds/inspect.ts`, `knowledge/worlds/selection.ts` e os consumidores `knowledge/corrections/{frame,propose,answer,undo,projection,scope}.ts`. O cut atual tem cinco domínios; identities não vazio é rejeitado pelos guards. Inspect literal retém sua base privada e a leitura histórica retorna o payload preservado. Correções carregam Frame/Case antes do commit em caminhos relevantes, portanto um decoder que aceite só a nova versão quebraria replay antes de chegar ao guard de compatibilidade. O candidato G agora exige auditar precisamente essa ordem.

A consulta histórica se limitou aos registros específicos C024/C025 e ZN-0038/0039/0040/SPEC-006 referenciados pelo candidato; não conferiu autoridade a código antigo, pacote ontology, clínica ou DDL. A proposta continua sujeita às invariantes atuais e à ratificação do integrador.

## Reavaliação de Q1 — revisão 4040ad6

Foi lido o diff completo de `78ae058` até `4040ad6`. A nova proposta `InspectIdentityRecovery` usa um tipo distinto, sem claims ou comparação de valores, mas com fechamento completo, linhagem e células estruturais. Só alimenta split/undo. A Question explicita que consequências comparativas não foram calculadas; nenhuma lista vazia mascara uma comparação inexistente. Nova equivalência continua exigindo a leitura comparativa completa.

Esse caminho resolve a contraprova específica: importar mais claims não altera os segmentos/células de identidade, portanto deixa disponível a inspeção estrutural necessária para desfazer a decisão original no cenário Q1. O DomainCut continua completo, inclusive claims/fontes/head/membership; o read set estrutural precisa proteger toda presença/ausência relevante. Não é permitido copiar um inventário incompleto de fontes ou inventar pins. Claims novas e histórico ficam preservados.

Classificação atual de Q1: **resolvido no desenho candidato, condicionado à aceitação explícita e prova futura**, não bloqueio lógico remanescente desse cenário. A nova família, seus discriminantes, recusa de uso para same-as/different-from e todos os consumidores devem entrar no pacote se o integrador ratificar a decisão. Se ela não for admitida, o bloqueio original de 78ae058 permanece; o relatório não autoriza uma API por si.

Limite preservado: isso garante que o excesso de claims sozinho não torna a identidade irrecuperável. Não garante undo arbitrário de qualquer decisão antiga após outras mudanças de grafo. Limites estruturais atuais/prospectivos precisam ser impostos por todos os writers, e inversões que excedam esses limites ou conflitem com distinções posteriores permanecem bloqueadas. A jornada deve explicar o impedimento real sem prometer reversão automática.

Oráculo ainda a executar depois de implementação autorizada: exceder os limites comparativos por imports reais, observar QuotaExceeded normal, obter recuperação completa sob base atual e confirmar undo; repetir com períodos desconhecidos, revalidação concorrente e viewer negado. Não foram executados testes de identidade nesta revisão documental.

## Reavaliação da precisão temporal — c2d2b70

Foi lido o diff `c2d2b70`: coalescência de células adjacentes com assinatura idêntica agora é obrigatória, até obter células maximais únicas; contagem, cellRef e digest ocorrem depois. Recuperação usa somente assinatura estrutural. Isso resolve a ambiguidade documental registrada acima. Continua necessária a prova futura de canonicidade no mesmo cut, inclusive ordem/orientação das arestas e fronteiras redundantes.
