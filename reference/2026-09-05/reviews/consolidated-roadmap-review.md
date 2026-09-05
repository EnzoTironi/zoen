# Revisão independente do desenho consolidado

Revisão de `zoen-rebuild/docs/roadmap.md`, `architecture.md` e `quality.md`, em 2026-09-05. Leitura do desenho; não aprovação de implementação futura. Tabela e registros em geração não foram tratados como ausentes.

**Parecer:** o desenho conserva a ambição, encurta a primeira jornada e remove dependências artificiais de canais, modelos, código hostil e federação. Duas precisões devem entrar nos contratos dos primeiros incrementos para evitar regressão de escopo.

1. **P1 versus apagamento/restore em D03.** A roadmap exige retenção mínima em P1, mas desloca supressão e prova de restore para D03, antes de habilitar apagamento. Essa mudança é defensável como uma fatia temporária explicitamente limitada, porém deve ser registrada como tal: P1 não conclui C062/C064 nem aceita dados cujo contrato exija eliminação que ainda não possa cumprir. Retenção/pins/GC e política de dados precisam valer no primeiro upload; restore oferecido antes de D03 deve permanecer fechado quando não puder demonstrar ausência de conteúdo suprimido. Sugestão concreta: D01/D02 admitem capturas sob política conhecida e fazem backup/restore do perfil sem apagamentos prévios; D03 implementa ledger independente do rollback, erasure e restore com supressões; antes de piloto sensível D04, D03 é gate obrigatório. Alternativamente, antecipar o núcleo do ledger para P1. Evitar concluir a capacidade completa porque um teste de staging passou.
2. **Apps iniciais versus publicação governada.** “D01 permite a apresentação declarativa inicial de D08” está correto para renderizar definições image-pinned já admitidas. Criar/editar/publicar significado runtime depende do núcleo correspondente de D02/D07 e da avaliação/política vigente. Tornar essa distinção explícita na primeira fatia de D08; do contrário, o paralelismo pode recriar uma publicação privilegiada provisória.

Pontos preservados corretamente: Case/Question/undo único desde a primeira correção; cobertura Unknown legítima; relógio local separado dos cuts; basis privado sem vazamento via tokens/metadados; identidade real; dados e serviços reais; ausência de mock de backend; executor único em web/CLI/Eve/apps; Effect 4 e TS7 único; Ultracite/CI abrangentes; módulos com composição real; ausência de autoaprovação; profiles externos independentes; qualidade Q transversal; nenhum descarte implícito de públicos ou capacidades. A definição de fases como agrupamentos sem barreira global está clara e deve orientar o DAG gerado.

A redação “Fly como destino proposto” pode ser afinada para **“Fly é o destino solicitado; sua ativação exige qualificação real”**. Preserva a direção do usuário sem declarar o ambiente já admitido. “Nenhum banco paralelo para Eve” deve ser entendido como nenhuma segunda autoridade semântica; Eve ainda precisa de seu journal durável próprio, que pode residir no mesmo Postgres com ownership/credenciais delimitados.

Não identifiquei necessidade de devolver decisões internas de protocolo ao humano. Os contratos propostos são concretos e se apresentam corretamente como mudanças de desenho a revisar, não como aprovação retroativa do plano antigo. Escolhas jurídicas/comerciais e acessos reais continuam gates apenas das funções pertinentes.

## Resolução após ajustes consolidados

Releitura dirigida das seções alteradas confirma a resolução das duas precisões de desenho. `invariants.md` mantém as 24 leis como contrato ativo e explicita política cumprível desde upload, recusa de dados incompatíveis, P1 sem concluir C062/C064 e restore anterior limitado ao perfil comprovado sem apagamentos prévios. O mapa coloca C062/C064 em P2; `deliveries.json` torna D03 dependência obrigatória de D04. `execution.json` inclui a política no contrato e a testemunha negativa de recusa com zero referência admitida.

A roadmap restringe D08 inicial às definições admitidas na imagem e exige D02/D07 e política vigente para criar/editar/publicar significado runtime. Fly consta como destino solicitado. A arquitetura distingue corretamente journal/leases operacionais de uma segunda autoridade semântica.

**Pendências deste parecer de desenho: nenhuma material nas seções revistas.** As evidências, políticas concretas e perfis citados continuam por implementar e testar. Esta resolução não aprova produto, código futuro, provedor, deployment ou conclusão de capacidade.
