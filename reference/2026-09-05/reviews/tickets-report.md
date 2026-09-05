# Auditoria integral do catálogo de tickets — redesenho greenfield

Data: 2026-09-05. Este documento é recomendação de organização e escopo de execução; não é implementação, aceitação de produto, autorização de fornecedor ou prova de segurança.

## Base e cobertura da análise

Foram processadas todas as 325 entradas de `planning/catalog.json` da referência `/tmp/zoen-review-stack-20260905`, seus 514 vínculos, tipos, 975 checks, locks e artefatos. Foram examinados título, resultado de aceitação e predecessores de cada entrada; exemplos de protocolo/steps foram aprofundados nos pontos de integração e governança. Foram consultados o índice e os 12 milestones e carregado o mapa das 157 capacidades. Não foram lidos os 325 documentos individuais nem auditada a implementação antiga. Logo, a conclusão é integral sobre o **catálogo e seu DAG**, não sobre correção do código ou equivalência integral entre catálogo e documentos de ticket.

` tickets-disposition.json ` contém exatamente uma entrada por ID, preservando títulos originais. Cada dependência antiga aparece para reconsideração; isso não significa que todas devam ser removidas. O campo registra a diferença entre redundância matemática, sequência adjacente e dependência entre recortes. Classificação de disposição:

| Destino | Quantidade | Significado |
|---|---:|---|
| implementation | 242 | Há comportamento/código real, a incorporar na entrega consolidada; não 242 novos PRs obrigatórios |
| test_obligation | 47 | Prova real junto à implementação, com camada correta; não funcionalidade independente |
| activation_criterion | 19 | Evidência de ativação de perfil/canal específico, mantida sem bloquear capacidades independentes |
| cross_cutting_requirement | 9 | Obrigação de preservação, governança ou operação incorporada aos critérios da entrega |
| consolidate_duplicate | 7 | Recortes sobrepostos a consolidar, preservando suas obrigações |
| conditional_work | 1 | Migração legada ZN-0050 somente quando houver fonte e necessidade reais |

O tipo antigo não determina automaticamente a disposição: ZN-0007–0011 são implementação de valores puros apesar de `kind=law`; ZN-0070–0073 contêm UI real apesar de `kind=journey`. ZN-0018 é uma prova apesar de `kind=component`. A leitura não descartou trabalho com base apenas no rótulo.

## Evidência do DAG e da granulação

- **325 nós, 514 arestas, zero ciclos, zero referências a IDs inexistentes.** A ordenação topológica cobre todos os nós. Não há um ciclo formal a corrigir no catálogo atual.
- **Uma raiz: ZN-0001. Caminho mais longo: 170 nós.** São profundidades de precedência, sem estimar dias ou duração. No máximo cinco nós têm a mesma profundidade mínima calculada; isso não é a largura máxima exata do poset nem previsão de capacidade humana.
- **286 arestas apontam ao ID imediatamente anterior; 261 delas ficam dentro da mesma spec.** São 55,6% das 514 arestas. A adjacência é um sinal para revisão, não prova automática de dependência artificial.
- **118 arestas são redundantes transitivas.** Removê-las preserva a ordem parcial e não encurta sozinha o caminho crítico. Exemplos: ZN-0019→0012, ZN-0014→0013, ZN-0291→0043 e ZN-0047→0024. A redução útil de serialização exige revisar vínculos semânticos, não apenas calcular redução transitiva.
- **216 tickets carregam `schema:authority`; 186 carregam `composition:trusted-roots`.** Se ambos forem locks exclusivos durante todo o trabalho, eles anulam grande parte do paralelismo permitido pelo DAG. Escrita de uma migração/registro pode requerer coordenação; desenvolvimento de todos os consumidores não deve reservar o schema inteiro.
- **Todos os 325 têm um `primary_artifact`; todos têm exatamente três checks.** Isso favorece planejamento por arquivo e tripla padronizada. Não prova que cada ticket seja literalmente inútil ou apenas um arquivo: ZN-0003, por exemplo, possui allowlist ampla, e muitos resultados de aceitação são específicos e úteis.
- **975 checks possuem 457 textos distintos de oráculo, com 518 ocorrências além da primeira.** Um único BOUNDARY genérico aparece 133 vezes; outro aparece 52 vezes. Os NEG e BOUNDARY de admissão mais comuns aparecem 23 vezes cada. Repetição textual não prova redundância dos comportamentos exercidos; prova que a contagem 975 não mede 975 verificações independentes implementadas.
- Tipos antigos: 231 component, 38 journey, 28 admission, 14 chaos, 9 law, 3 static, 2 performance. Há 24 gates externos nomeados, cada um associado a um ticket; 301 tickets não têm `external_gate`.

## O que deve mudar na ordem

1. **Primeira função não espera toda a máquina de admissão.** ZN-0001→0002→0003→0004→0005→0006→0007 torna regras de promoção/proveniência predecessoras dos tipos puros. Preservar inventário, instalação real, segredo, TS7 e CI desde o início; anexar assinatura/proveniência ao deploy real e revisão à mudança correspondente. Não produzir execution-lock fictício nem ignorar incompatibilidade concreta.
2. **Os valores puros podem ser feitos em paralelo após seus contratos mínimos.** Money ZN-0008, time ZN-0009 e canonical ZN-0010 não precisam seguir uma fila apenas por ID. Canonicalização pode consumir o contrato comum, mas não deve exigir concluir toda a implementação de calendário.
3. **Genesis/authority já têm divisão que evita ciclo formal.** Preservar esse acerto: ZN-0013 fornece presença e ZN-0019–0024 fornecem autoridade. Integrar genesis e commit em uma composição, com prova real conjunta; não criar executor privilegiado alternativo para liberar paralelismo.
4. **ZN-0030 pede Frame, mas depende só de ZN-0029.** Interpretação ZN-0031–0036 e Frame ZN-0042–0045 surgem depois. Adicionar aresta reversa no desenho atual criaria ciclo. Mover a prova ao final da entrega de verdade privada; componentes de captura mantêm provas locais antes disso.
5. **ZN-0049 exige que artefato apagado continue indisponível após restore**, mas o mecanismo de supressão está em ZN-0116, posterior a S0. Antecipar o mínimo efetivamente necessário de supressão ou declarar precisamente o escopo inicial do restore. Não certificar apagamento que ainda não existe.
6. **Autorização real não pode nascer só em ZN-0106**, depois de steward/source e telas que já prometem sigilo. O autorizador comum e isolamento do perfil privado pertencem à primeira leitura. Delegação, audiência e direitos derivados ampliam o mesmo serviço; não autorizam uma política provisória privilegiada.
7. **Onboarding, acessibilidade e logout não dependem de WhatsApp/voz.** ZN-0070 depende de ZN-0062 e ZN-0068; transportar os componentes essenciais para a primeira UI. Da mesma forma, webhook textual ZN-0064 não precisa depender de áudio ZN-0062.
8. **Busca e transportes não precisam esperar a agência completa.** Rever ZN-0147→0146 e ZN-0153→0152. Implementar busca autorizada e adaptadores sobre evidência, autorização e manifesto; adicionar limites de agentes e observação de Mandates quando esses consumidores existirem.
9. **Receitas independentes não formam pipeline.** A cadeia Google ZN-0237→M365 ZN-0238→CRM ZN-0239→ERP ZN-0240→PostgreSQL ZN-0241→warehouse ZN-0242 serializa provedores distintos. Cada qual consome o contrato de fonte adequado; conta e qualificação reais limitam a respectiva ativação.
10. **Security master e execução local não esperam federação.** Rever ZN-0261→0254 e ZN-0273→0254; manter dependência de federação somente no perfil com múltiplos Worlds/células.
11. **Apps declarativos já foram antecipados parcialmente no catálogo.** Não reintroduzir a dependência de Rivet/runner/Iceberg que ZN-0203 e ZN-0305 explicitamente excluem. ZN-0305 inclui geração por Eve; separar primeiro app autorado de geração assistida preserva o resultado futuro, mas exige reescrever a aceitação de cada incremento.
12. **Sobreposição não exige duas implementações.** Consolidar ZN-0043/0291, ZN-0203/0302–0305, ZN-0204/0308–0311 e ZN-0205/0313. Manter diferenças legítimas entre teste de protocolo e admissão real do host. Recall básico ZN-0307 deve acompanhar primeira publicação, mesmo que upgrades avançados esperem packs.

## 22 entregas propostas

Estas são unidades de produto com provas observáveis e um dono de integração, não 22 tarefas de tamanho igual nem 22 PRs gigantes. Cada uma pode ter incrementos curtos. Só detalhar arquivos/PRs dos incrementos imediatamente executáveis; dependências abaixo são de composição da entrega, não proibição de preparar consumidores a partir de contratos revisados. IDs no JSON são rastreabilidade, não ordens para recriar os arquivos antigos.

| Unidade | Resultado verificável e prova | Dependências reais propostas |
|---|---|---|
| D01 — Verdade privada em web e CLI | Pessoa autenticada cria World, importa dois registros reais em PostgreSQL+S3, vê comparação honesta/evidência nos dois clientes; acesso de outra pessoa é negado, retry não duplica. Inclui baseline mínimo, IDs/decimais/tempo, executor único, composição, CI, logout e observabilidade segura. | Contratos mínimos e serviços Docker reais; sem modelo/canal/runner |
| D02 — Corrigir uma divergência e desfazer | Correção/unknown/identidade mantêm escopo, proveniência e cortes antigos; atualização relevante invalida pergunta obsoleta. | D01; stewardship avançado consome D03/D05/D07 conforme função |
| D03 — Compartilhar sem vazar e apagar sem ressuscitar | Convite, link protegido, audiência limitada, revogação, linhagem e apagamento testados entre duas identidades; restore não reabre conteúdo suprimido. | D01; sessão de app conecta-se a D08 quando existir |
| D04 — Usar o primeiro produto hospedado | Deploy real Fly com PostgreSQL/S3, rollout/restore observados e recursos indisponíveis declarados; preservar legado, sem cutover implícito. | D01 e controles D03 aplicáveis ao dado habilitado; sem WhatsApp obrigatório |
| D05 — Conversar com fatos e continuidade | Eve consulta executor, responde com evidência e incerteza, recupera turnos e cancela; sem exportar dados para modelo não permitido. Áudio é incremento próprio. | D01; provedor real permitido para ativar conversa |
| D06 — Continuar por canais autorizados | Um canal real primeiro, outros em paralelo: ingress durável, vinculação sem autoridade implícita, continuidade e entrega desconhecida honesta. | D05 e links D03; gate individual do provedor |
| D07 — Ensinar uma regra/domínio sem redeploy | Alterar regra/pack familiar ou confeitaria, avaliar isoladamente e ativar atomicamente sob política atual; histórico permanece explicável. | D01/D02; sem fonte externa obrigatória |
| D08 — Abrir um app privado sobre a mesma verdade | Board e contas declarativos com evidência, tabelas/Focus, consultas limitadas, SDK/MCP e formulários somente via executor; paridade sob contexto/corte iguais. | D01; publicação dinâmica D07; sessão/link D03; forms dependem D11; geração assistida depende D05 |
| D09 — Conectar e reconciliar fontes reais | Uma fonte autorizada, paginação/retry/ACL/drift/tombstone honestos; depois receitas empresariais em paralelo e reconciliação entre métricas. | D01/D03/D07; CDC/dados densos e fonte virtual integram D16/D17 somente quando usados |
| D10 — Avisar uma mudança relevante | Watch produz um Notice deduplicado, silêncio para ruído e nenhuma mensagem depois de revogação. | D02/D03; composição conversacional D05 e envio D06 quando escolhidos |
| D11 — Aprovar uma decisão uma vez | Consequência explícita, revisão de Case e aprovação atual; corrida ou guard alterado retorna Stale, sem duplicar resultado. | D01/D03/D07; chat/app são clientes incrementais D05/D08 |
| D12 — Executar e acompanhar responsabilidade | Um efeito externo real reconcilia resultado ambíguo; Mandate observa objetivo independentemente do envio e conserva orçamento sob retry/cancelamento. | D11; provedor real para ativar efeito; não exige WhatsApp |
| D13 — Buscar e delegar análise com direitos | Busca/ranking/counts não dependem de dados escondidos, referências mantêm frescor; agente especializado não amplia autoridade/orçamento. | D01/D03; agente integra D05/D12 para uso de modelo e orçamento |
| D14 — Operar agenda clínica com separação | Disponibilidade conhecida não vira promessa; equipe administrativa não vê dado clínico; disputa de horário não duplica agendamento. | D03/D07; D11/D12 para ação; ativação clínica real exige escopo adequado |
| D15 — Executar extensão isolada e revogável | Artefato revisado num runner real, credenciais brokeradas, limites externos, host/bridge sem outra API semântica; recall bloqueia novas execuções. Rivet/MCP Apps são perfis separados. | D03/D07/D08/D11; runtime/provedor real só para seu perfil |
| D16 — Publicar dados densos e acompanhar feeds | Snapshot imutável e conjunto atômico, CDC/gaps/late data explicados, entitlement revalidado e quote capturada antes de decisão. | D01/D03/D09; D11 para uso consequencial; sem Studio/runner geral obrigatório |
| D17 — Comparar cenários e análises atribuídas | Overlay não altera live; aplicar requer Case novo. Consulta virtual/GPU/modelos guardam fonte, custo, incerteza e direitos. | Cenário mínimo D01/D03/D11; perfis externos D15/D16 quando necessários |
| D18 — Evoluir apps/packs no Workshop | Editar definição, instalar/atualizar/recallar pack sem sobrescrever significado local; resolver conflito de rebase e manter app válido. | D07/D08; executáveis D15; marketplace só ativa com condições comerciais reais |
| D19 — Operar instituição com identidade e limites | SSO/SCIM revoga trabalho em voo; cell/residência/suporte/quota/recuperação medidos num perfil real, sem rótulo de escala sem prova. | D03/D04; D09/D12/D16 conforme capacidades habilitadas, não toda ambição prévia |
| D20 — Mover e federar sem dois escritores | Migração mantém um autor, federação preserva cortes/efeitos parciais, offline só em escopo filho limitado; self-host/fleet qualificados separadamente. | D11/D12/D19; casos independentes de federation/offline não precisam bloquear finanças locais |
| D21 — Entender dados financeiros e risco | Identificação qualificada, histórico/licença, posições, valuation e risco reproduzíveis; gap/cotação vencida impedem conclusão indevida. | D03/D09/D11/D16; análise de stress D17 quando usada |
| D22 — Acompanhar ordem até custódia real | Ordem/execução/bust/cancel/alocação/custódia conservam quantidades; desconhecido não vira settlement e cada broker/custodiante tem escopo real. | D11/D12/D21; D20 somente perfil federado |

ZN-0281–0286 e ZN-0325 são capstones/matriz **transversais** atribuídos administrativamente a D22 no JSON para haver um destino único por ticket. Não significam que testes de consumidor, segurança ou matriz só ocorram em D22. Desmembrar seus cenários de aceitação entre as entregas desde D01; a ambição completa continua exigindo reunião de toda evidência aplicável.

D01 tem 45 referências antigas porque absorve plataforma e requisitos que já são necessários ao primeiro resultado. Sua primeira composição deve ser estreita: um owner real, uma operação de criação, um formato de captura limitado e Inspect em web/CLI. Não alegar concluir todos os formatos, políticas ou testes associados por concluir esse primeiro incremento. Avançar CSV/JSON, recortes históricos e limites com suas próprias provas. Essa técnica reduz tempo até valor sem declarar que a unidade completa está pronta antes da hora.

## Execução paralela recomendada

**Antes do código amplo:** pactuar apenas os contratos consumidos pela primeira entrega: contexto autenticado World/realm/purpose, operação com identidade e digest, resultados tipados, envelope de commit, EvidenceRef e Frame com base/proveniência, e portas Effect 4. Contrato precisa ter consumidor e implementação real previstos; nenhum pacote de interfaces desconectado conta como entrega.

**Primeira composição:** trilhas independentes de (a) CI/toolchain Docker e serviços reais, (b) valores puros/schema, (c) presença/genesis/authority, (d) captura S3+PostgreSQL, (e) executor/inspect e cliente web/CLI. Trilha (c) integra contrato de (b); (d)/(e) podem preparar componentes puros e UI com estados explícitos, mas só aceitam integração com serviços reais. Nomear um integrador para composição e migrações; ele coordena conflitos curtos, não detém lock global durante todos os trabalhos. Nenhum mock de serviço para simular produto completo.

**Depois da primeira leitura real:** D02, D03, D04, D05 e o contrato declarativo D07 podem avançar em paralelo nos limites disponíveis. D08, D09, D10, D11 e D13 consomem o executor/contratos estabilizados; provedores D06 e D09 recebem trilhas independentes por conta real. D12/D14 seguem quando a operação necessária existe. D15–D22 mantêm requisitos e investigação de bloqueios reais, mas não uma árvore enorme de arquivos antecipados.

Agentes GPT-6-Astra com esforço low recebem subtarefas concretas de produto ou prova independente, acesso ao pacote reduzido do requisito e allowlist por mudança. Um agente por arquivo não é estratégia de produto. Contratos, migrações, package lock e ponto de composição possuem dono temporário; trabalhos de consumidores não monopolizam esses locks. O revisor independente verifica a mesma jornada/commit com serviços reais e distingue resultado observado de requisito ainda pendente. Paralelismo máximo útil é limitado por contratos e recursos reais; não há estimativa justificável de 325 agentes ou aceleração linear.

## Aceitação e gates sem burocracia substituta

Manter o que protege comportamento: autorização antes de leitura e envio; transações e deduplicação; revogação; proibição de fonte/modelo obter credenciais; retenção/restore; prova da contenção antes de executar código não confiável; licenças e permissão real antes de ativar dados/efeitos regulados. Nenhum gate externo ausente autoriza inventar API, identidade ou resultado.

Trocar a conta fixa AC/NEG/BOUNDARY por cenários necessários à operação. Uma mesma prova pode sustentar vários requisitos com rastreabilidade explícita; vários testes podem ser necessários para um único requisito. Compilação TypeScript 7 e Ultracite zero diagnósticos provam qualidade estática, não segurança do serviço ou prontidão do provedor. Leis puras são diretas; integração usa PostgreSQL/S3 reais; navegador prova fluxo e isolamento; processo morto prova fronteira durável; carga mede um envelope declarado. Review independente não é autoaprovação.

Os milestones atuais já permitem desenvolver código pronto para dependências por trás de capacidades desabilitadas. Portanto não é correto dizer que todos os gates formalmente impedem todo desenvolvimento. O problema é a fila de predecessor, locks amplos e aceitação de milestone inteiro em sequência. Reorganizar ativação por capacidade utilizável; manter matriz com `não implementado`, `implementado sem prova`, `verificado no perfil`, `ativado`, `bloqueado por dependência real`. Esses nomes são proposta, não resultados observados.

## Organização versus mudança de escopo

**Correção organizacional, mantendo produto:** consolidar duplicações; mover provas para a implementação consumida; remover dependências documentais injustificadas; antecipar executor/autorização; permitir fontes e superfícies em paralelo; habilitar apenas perfis reais comprovados; substituir 975 caixas por evidência rastreável; manter dados/história e requisitos das 157 capacidades. Trocar a ordem das entregas não significa excluir a ambição final.

**Mudança explícita de escopo ou tecnologia:** abandonar finanças, clínica, federação/offline, marketplace, voz, qualquer um dos transportes/receitas prometidos ou runtime executável; substituir tecnologia ainda obrigatória em specs por preferência; eliminar perfil Python/R do usuário sob interpretação expansiva de “TypeScript único”; retirar runtime change, licenças, aprovação ou isolamento; encerrar o produto em D01/D08 e chamá-lo integral. Esses pontos não estão autorizados pela simples consolidação.

As diretrizes novas Effect 4 nativo, TypeScript 7 único, Ultracite zero diagnósticos+CI e PostgreSQL/S3 reais via Docker/Fly prevalecem sobre menções antigas a v2/ESLint/shape de workspace. O efeito dessa mudança sobre Restate, runtimes Python/R, Cedar binding e ferramentas de compilação deve ser decidido concretamente na composição: preservar semântica, registrar incompatibilidade real e não inventar portabilidade. O catálogo sozinho não comprova versões atuais nem disponibilidade dessas integrações.

## Limites e próxima decisão concreta

Este trabalho não afirma que todas as arestas adjacentes sejam artificiais, que todos os checks repetidos sejam dispensáveis, que todos os gates sejam exagerados ou que 22 unidades tenham tamanho equivalente. Oferece um inventário completo de disposição e os pontos de corte para um novo backlog por resultados. Próximo passo: escolher a composição mínima D01 e seus contratos, reescrever somente seus incrementos executáveis e critérios de prova; tratar bloqueios externos em trilhas próprias. Não regenerar imediatamente 325 tickets ou 975 pseudotestes.
