# Leis preservadas no redesenho

Este é um contrato ativo de produto, não evidência de implementação. Preserva as 24 leis da constituição v4 na nova organização. O usuário pode mudar o escopo; um pacote de trabalho, dado externo ou conveniência de implementação não pode enfraquecer uma lei. As alterações deliberadas de recorte e contratos estão em [roadmap.md](roadmap.md). Conflito real é resolvido pelo orquestrador com revisão antes de despachar o código afetado.

| ID | Lei | Testemunha adversária exigida quando aplicável |
| --- | --- | --- |
| INV-01 | Identidade prova presença; autoridade concede direitos de domínio; superfícies (web/CLI/MCP) não possuem verdade paralela. | Superfície de transporte não importa nem recebe credencial da base de autoridade |
| INV-02 | Evidência, claim atribuída, interpretação, decisão, tentativa de efeito e settlement observado são fatos distintos. | Uma mensagem “paguei” não cria settlement bancário |
| INV-03 | Comparar significado, identidade, escopo, unidade e tempo antes do valor. | Reservado 1000, faturado 800 e recebido 600 não são automaticamente conflito |
| INV-04 | Cópias de fonte não constituem suporte independente; preservar linhagem. | Dez cópias continuam uma família de suporte |
| INV-05 | Resposta humana tem tipo e escopo; correção local não instala regra reutilizável. | Corrigir um pedido não altera outro pedido ou RuleDefinition |
| INV-06 | Leitura, replay, retomada e divulgação tardia usam autorização atual. | Revogação antes da emissão impede conteúdo sensível |
| INV-07 | Dados ocultos não influenciam observação permitida: conteúdo, contagem, ranking, confiança, erros, contexto do modelo e metadados públicos. | Pares que diferem só no oculto produzem observações permitidas equivalentes |
| INV-08 | Decisão vincula significado liberado exato e read set completo, incluindo predicados e ausência. | Inserção de invoice que passa a satisfazer o predicado torna Case pendente Stale |
| INV-09 | Uma transação local confirma estado semântico, receipt e outbox; rede/modelo ficam fora dela. | Matar processo em fronteiras reais produz tudo ou nada |
| INV-10 | Mesma identidade de operação e intenção têm um resultado; intenção diferente conflita; replay reautoriza. | Retry concorrente cria um receipt sem revelá-lo a ator revogado |
| INV-11 | Worker durável usa fencing; durabilidade não prova efeito externo exatamente uma vez. | Provider aceitou, resposta se perdeu: Unknown até reconciliação |
| INV-12 | Variação de usuário/agente é dado dentro de capacidades admitidas; novo poder exige código e revisão próprios. | Release candidata não concede ao autor poder de aprová-la |
| INV-13 | Evaluation e live não compartilham autoridade, credenciais, destinos de efeito ou identidades de destinatários. | Ação de avaliação não chega a banco live ou pessoa real |
| INV-14 | Dataset publicado vincula snapshot exato e pins físicos de retenção antes da publicação em autoridade. | GC concorrente não elimina snapshot publicado |
| INV-15 | Observação live é efêmera até captura exata autorizada; gaps e vencimento de entitlement são explícitos. | Preço latest não substitui observação vinculada ao consentimento |
| INV-16 | Mandate limita escopo, ações, orçamento, prazo, parada e resultado observável. | Reservas filhas 70+70 não excedem limite raiz 100 |
| INV-17 | World tem um writer ativo por cell/epoch; promoção exige fencing real da origem. | Primário inacessível não é substituído sem contenção independente |
| INV-18 | Federação tem cuts e aprovações locais independentes; não promete ACID ou relógio global da verdade. | Rejeição remota produz resultado parcial explícito |
| INV-19 | Retenção, apagamento, holds e restore são políticas executáveis, incluindo derivados e backups. | Backup antigo não ressuscita conteúdo do ledger de supressão |
| INV-20 | Conclusão depende de evidência do commit, lock, perfil e checks necessários. | Build verde não conclui trabalho cujo teste obrigatório não executou |
| INV-21 | Humano, agente, app e operação programática passam pelo mesmo executor semântico. | SQL/export/stream exclusivo de app ou política duplicada falha na conformidade |
| INV-22 | URL de continuação não concede autoridade; uso/sessão intersecta direitos atuais de sujeito, app, propósito e fonte. | Link encaminhado não empresta privilégio do publicador nem revela metadados protegidos |
| INV-23 | Build/runtime, significado publicado, acesso concedido e resultado externo são fatos independentes. | Deploy Rivet bem-sucedido não publica nem autoriza app |
| INV-24 | Execução de app é isolada; disclosure privado para guest exige perfil de fluxo de informação admitido. | Código frontend não aprovado não recebe dados privados; iframe não prova DLP universal |

## Contratos da primeira composição

Genesis usa o mesmo commit SERIALIZABLE. Antes de existir World, deduplica por `(principal, CreatePersonalWorld, operationId)` e cria World, head, membership, receipt e outbox atomicamente, verificando a seed admitida. Após genesis, a chave é `(World, principal, semanticOperation, operationId)`. Transporte não entra na chave. IDs distintos representam intenções distintas; o mesmo ID não permite mudar a intenção.

O commit adquire locks na ordem definida, verifica writer epoch, geração/significado liberado, revisão de segurança e guards de domínio/predicado/fonte/identidade/tempo. O limite preservado é **três tentativas totais** apenas para falha de serialização/deadlock, com a mesma intenção e sem recalcular consentimento. Esse retry não se aplica ao envio externo ambíguo.

Interpretação mantém seleção `unknown | unresolved | selected | set-valued`, com verificação e contestação independentes. Case tem estados explícitos, inclusive blocked e cancelled; cancelar intenção não prova cancelamento da realidade externa. Correção, undo e identidade histórica preservam autoria e proveniência autorizadas.

O primeiro upload exige política de dados conhecida e cumprível, durabilidade, pins e limpeza segura. P1 não conclui C062/C064. Dados que exijam apagamento ainda indisponível não são admitidos nesse perfil. Antes de oferecer apagamento e antes do piloto sensível D04, D03 implementa supressão que sobrevive ao rollback de restore e prova o comportamento real. Restore anterior se limita a perfil comprovado sem apagamentos prévios; se isso não puder ser demonstrado, permanece bloqueado.

## Economia e limites

Uma gramática serve públicos domésticos, profissionais e institucionais. Definições/packs expressam variação; não `if customer` ou kernel separado. Recursos entram quando a jornada os consome. Extrair código compartilhado quando usos concretos demonstram a mesma semântica; não construir framework especulativo.

Estado de transporte e leases/progresso de workers são persistência operacional legítima, com dono e credenciais delimitados, inicialmente no mesmo PostgreSQL se adequado. Nunca passam a ser outra autoridade, política de domínio ou reconciliação. Schema `eve` (migração 019) permanece inerte — sem superfície de produto Eve.

Inventário de produção, permissões/licenças, contas cloud, APIs atuais e cargas reais exigem evidência externa. Planos não substituem esses fatos. Não há mock de serviço, identidade privilegiada de desenvolvimento, fallback offline ou resultado de benchmark fabricado. Funções puras são testadas diretamente; integração usa componentes reais.
