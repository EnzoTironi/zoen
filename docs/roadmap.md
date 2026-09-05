# Roadmap de execução

## Primeiro resultado

Uma pessoa entra por autenticação real, cria um World, importa dois arquivos CSV/JSON que divergem sobre o mesmo compromisso, inspeciona a interpretação e sua evidência, faz uma correção com escopo explícito e a desfaz sem apagar o histórico. Web e CLI observam o mesmo significado; outra pessoa não acessa o conteúdo. A jornada usa PostgreSQL e S3 reais e funciona sem modelo de linguagem.

A primeira composição pode aceitar apenas um formato e uma operação estreita. Isso é um incremento de D01, não conclusão de todos os requisitos associados. Expandir formatos, correção, isolamento, retenção e recuperação com suas respectivas provas. Manter os cenários doméstico, confeitaria, clínica e finanças na ambição, sem escolher um novo público comercial por inferência.

## Seis fases

| Fase | Resultado | Entregas e condição de saída |
|---|---|---|
| P1 — Verdade privada utilizável | Capturar, comparar, explicar, corrigir e desfazer | D01/D02; direitos, retenção e limites mínimos já necessários. Jornada real em web/CLI, histórico, retry e isolamento comprovados |
| P2 — Uso contínuo e colaboração | Compartilhar/revogar, hospedar e conversar com fatos | Núcleos D03/D04/D05; busca, Notices, primeiro conector e packs operacionais podem ter incrementos. Ativar só providers realmente verificados |
| P3 — Adaptação pelo usuário | Regras, definições e apps declarativos sem redeploy | D07/D08 e núcleos D11/D18; API/SDK/MCP, cenários simples. Publicação e mudança de significado avaliadas e governadas |
| P4 — Ação e responsabilidade | Aprovação, efeito real, Mandate, observação e canais | D06/D10/D11/D12 e agentes de D13; Unknown e orçamento conservados. Ações clínicas dependem dos controles próprios de D14 |
| P5 — Extensão e operação institucional | Código isolado, dados densos/live, compute, conectores e SSO | D09/D14/D15/D16/D17/D19 conforme perfil; carga, recuperação, isolamento e permissões externas medidos |
| P6 — Ecossistema e ambição completa | Mobilidade/federação/offline, marketplace e finanças até custódia | D18/D20/D21/D22 e reunião da matriz transversal Q. Cada perfil mantém sua própria prova e ativação |

Fases organizam resultados, não criam uma barreira global que exige terminar toda a fase anterior. Um conector independente, busca autorizada ou finanças locais pode avançar quando seus contratos e recursos estiverem disponíveis. O mapa de capacidades registra a fase de conclusão do alcance completo planejado; um subconjunto útil pode aparecer antes sem receber o selo da capacidade inteira.

## Decisões do novo desenho

Estas decisões são propostas concretas do redesenho solicitado e precisam orientar os contratos antes de iniciar código; não são alegações de que o plano antigo já as aprovava. O orquestrador resolve detalhes internos com revisão, sem devolver ao usuário a tarefa de projetar protocolos.

- **Correção e Question cedo:** Case mínimo inclui intenção, escopo, ator, base privada, dependências, revisão e consequência; Question guarda destinatário, resposta permitida e versão. Resposta obsoleta retorna Stale. Undo é nova decisão compensatória que revalida o estado atual. D11 amplia ações e aprovações no mesmo caminho.
- **Cobertura parcial legítima:** fonte esperada, fonte admitida, lacuna, qualidade e frescor são dimensões distintas. Sem inventário completo conhecido, completude é Unknown. Ausência de evidência não vira zero; ação que exige cobertura completa permanece bloqueada.
- **Relógio separado da base:** timestamp/amostra da autoridade PostgreSQL local avalia tempo e prazo; não certifica um snapshot global de fontes. Cuts e revisões de fontes pertencem à base da decisão. Documentar precisão/incerteza aplicável ao perfil real.
- **Base privada, projeção pública:** dependências, epochs e revisões internas não são devolvidas automaticamente. Opaque token não basta se suas mudanças expõem atividade escondida. Payloads e metadados passam pelo mesmo requisito de não interferência.
- **Retenção desde a captura:** staging, admitido, indisponível e apagamento pendente são distintos. Pins e política explícita protegem payloads usados. D03 implementa supressão e prova de restore antes de habilitar/promover apagamento; o piloto D04 só promete as operações que comprovou. Nenhum prazo legal ou hold presumido.
- **Uma operação, várias superfícies:** web/CLI primeiro, Eve/SDK/MCP/apps depois. App declarativo não exige runner, Rivet, GPU ou marketplace. A criação assistida por Eve é um incremento adicional.
- **Ativação por perfil:** modelo, WhatsApp, Telegram, OAuth, feed, GPU, broker e custodiante são dependências apenas das funções que os utilizam. APIs e permissões ausentes permanecem bloqueios explícitos.
- **Operação enxuta:** Docker primeiro, Fly como destino solicitado; módulos substituem a organização por spec. A configuração antiga de AWS não será copiada por inércia. Migração de sistema/dados existente continua exigindo inventário e cutover explícitos.

## Entregas e dependências

Há 22 entregas de produto mais Q, uma trilha de qualidade transversal. Cada entrega admite incrementos pequenos e PRs revisáveis; não são 22 PRs gigantes. `depends_on` abaixo identifica o núcleo previamente integrado que fornece os contratos necessários. Perfis/expansões opcionais têm pré-condições próprias e não bloqueiam o núcleo independente. A dependência exata será congelada no pacote de cada incremento antes de despachá-lo.

O registro estruturado é [planning/deliveries.json](../planning/deliveries.json). Todas as entregas estão **planejadas**, não implementadas. Nenhuma capacidade foi retirada; o destino de cada ticket e capacidade está nos mapas de rastreabilidade.

| ID | Resultado | Núcleo necessário | Dependências por perfil / ativação |
|---|---|---|---|
| D01 — Verdade privada em web e CLI | Autenticar, criar World, importar duas fontes, comparar com evidência e direitos atuais; retry não duplica. | — | Autenticação, PostgreSQL e S3 reais. |
| D02 — Correção e identidade reversíveis | Corrigir/unknown/undo com escopo e histórico; merge/split e stewardship em incrementos próprios. | D01 | Nenhum provider obrigatório para correção local. |
| D03 — Compartilhamento, revogação e apagamento | Compartilhar sob audiência limitada e revogar em voo; supressão impede ressurreição após restore. | D01 | Política de retenção/hold aplicável e store real; sessão de app só quando D08 existir. |
| D04 — Primeiro produto hospedado | Deploy Fly, operação e restore reais no escopo habilitado, sem cutover implícito. | D01, D03 | Conta/topologia Fly, secrets, persistência, backup e recuperação verificados. |
| D05 — Eve com evidência e continuidade | Conversar com fatos, incerteza, cancelamento e journal recuperável; voz como incremento. | D01 | Modelo permitido e API/conta real; voz possui perfil próprio. |
| D06 — Canais autorizados | Ingress durável, vínculo sem autoridade implícita e continuidade; resultado de entrega desconhecido honesto. | D03, D05 | Cada canal tem provider/conta e consentimento próprios; canais independentes. |
| D07 — Significado e regras em runtime | Editar regra/pack, avaliar e ativar geração exata atomicamente, mantendo história explicável. | D01, D02 | Gramática/IR limitados aos operadores implementados. |
| D08 — Apps declarativos e superfícies | App privado usa mesma verdade; ampliar para publicação, SDK/MCP, forms e criação assistida. | D01 | Publicação runtime exige D07; sessão D03; forms D11; assistência D05. |
| D09 — Fontes e reconciliação reais | Uma fonte autorizada primeiro; paginação, ACL, tombstones e drift; receitas independentes depois. | D01, D03 | Conta/API real por fonte. Mappings runtime exigem D07; CDC D16; virtual D17. |
| D10 — Watches e Notices | Mudança relevante gera Notice deduplicado; ruído e revogação impedem envio indevido. | D02, D03 | Notice local sem provider; transporte exige perfil D06 habilitado. |
| D11 — Decisões e aprovações governadas | Case com consequência explícita e aprovação atual; guard alterado retorna Stale sem duplicar decisão. | D01, D03, D07 | Nenhum provider obrigatório para consequência local. |
| D12 — Efeitos e Mandates | Efeito real, reconciliação de Unknown, orçamento conservado e observação independente do envio. | D11 | Provider de efeito real; contrato de idempotência/consulta e permissão explícitos. |
| D13 — Busca e agentes com direitos | Busca/ranking/counts autorizados; agente especializado não amplia direitos nem orçamento. | D01, D03 | Busca básica independente; modelo e delegação requerem D05/D12. |
| D14 — Operação clínica separada | Agenda administrativa preserva separação clínica; disputa não duplica agendamento. | D03, D07 | Escopo clínico qualificado; consequência real usa D11/D12. |
| D15 — Extensões e apps isolados | Artefato revisado no runner real; limites, broker, recall e bridge sem segunda semântica. | D03, D07, D08, D11 | Isolamento real; Rivet e MCP Apps são perfis independentes, não pré-requisitos declarativos. |
| D16 — Dados densos, CDC e live | Publicação de snapshot/conjunto atômico; gaps, late data, entitlements e captura da quote explícitos. | D01, D03, D09 | Store/feed e licença reais por perfil; decisão consequencial exige D11. |
| D17 — Cenários e compute atribuídos | Overlay não muda live; aplicar gera Case novo. Virtual/GPU/modelos preservam custo e direitos. | D01, D03, D11 | Cenário local independente; runner/GPU/fonte virtual precisam contratos e recursos reais. |
| D18 — Workshop, packs e ecossistema | Editar/instalar/atualizar/recallar sem sobrescrever significado local; rebase explícito. | D07, D08 | Workshop declarativo em P3; executáveis D15; marketplace comercial exige condições reais. |
| D19 — Operação institucional | SSO/SCIM, residência, suporte, quotas e capacidade; revogação do trabalho em voo. | D03, D04 | IdP, cell, rede e envelope de carga/recuperação reais por perfil. |
| D20 — Mobilidade, federação e offline | Um escritor na migração; cortes/efeitos parciais na federação; offline filho limitado. | D11, D12, D19 | Infraestrutura real; self-host e fleet qualificados separadamente. |
| D21 — Informação financeira e risco | Master, corporate actions, posições, valuation e risco reproduzíveis com histórico e licença. | D03, D09, D11, D16 | Direito aos dados/feed e qualidade reais; stress pode consumir D17. |
| D22 — Ordens até custódia | Ordens/fills/busts/cancel/alocação/custódia conservam quantidades; Unknown não é settlement. | D11, D12, D21 | Broker/custodiante e supervisão reais; federação só para perfil D20. |


## Ordem depois da primeira jornada

Com D01 integrado, preparar D02, o núcleo de D03, a operação D04 e Eve D05 em paralelo conforme os três slots. D02 destrava o significado runtime de D07; D01 também permite a apresentação declarativa inicial de D08, restrita a definições admitidas na imagem. Criar/editar/publicar significado em runtime exige D02/D07 e avaliação sob política atual. Compartilhamento habilita busca e primeiros conectores sem exigir a agência completa.

Depois, separar receitas de provedores e canais por conta real e contrato consumido. Google, M365, CRM e ERP não formam uma fila por nome. Ações e Mandates não dependem de WhatsApp. Finanças locais não dependem de federação. D15–D22 preservam critérios e bloqueios, mas não recebem milhares de arquivos antes de haver interfaces estáveis.

## Rastreabilidade e mudança de estado

Os 325 tickets antigos viram referências de requisito, prova ou ativação. As 56 specs são fontes de intenção; os 157 registros de capacidade conservam seu alcance. Q recebe os capstones ZN-0281–0286 e ZN-0325, evitando colocá-los artificialmente no fim da entrega financeira. Provas de segurança/consumidor entram desde D01 e são ampliadas ao longo do produto.

Estado de execução por incremento: `planned` → `ready` → `in_progress` → `implemented_unverified` → `verified_for_profile` → `activated`. `blocked` exige a dependência concreta registrada. Esses estados não são percorridos automaticamente por gerar um arquivo, concluir uma análise ou passar lint.

Para declarar `ready`, o pacote precisa de consumidor, contratos versionados, dependências satisfeitas, dono exclusivo, recurso real de teste e testemunha de aceitação. O orquestrador só detalha a próxima fronteira de trabalho pronta. Mudança de contrato invalida os dependentes afetados; mudança de fase por si só não autoriza operação nova.

As [24 leis ativas](invariants.md) preservam as restrições do produto. P1 não conclui C062/C064: só admite dados sob política cumprível; D03 e a supressão verificada são pré-requisitos do piloto sensível D04.
