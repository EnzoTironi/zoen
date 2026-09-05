# Revisão independente do desenho consolidado

Leitura de README, AGENTS e docs/{architecture,quality,roadmap,audit} em 2026-09-05. Sem execução de produto, alterações no rebuild ou julgamento dos arquivos planning ainda em geração.

**Parecer:** a redução a cinco workspaces está consistente. Effect substitui infraestrutura repetida; não encontrei proposta de framework de negócio redundante. As afirmações de prova estão delimitadas adequadamente: cobertura de registros e consistência estrutural não são apresentadas como produto aprovado. Há três pontos a corrigir antes de despachar implementação afetada.

1. **Alta — lacuna de autoridade normativa dos invariantes preservados.** AGENTS.md:5 torna reference/archives não normativos; roadmap.md:51 chama as specs de fontes de intenção. Isso é correto para desativar instruções antigas, mas os documentos atuais não tornam explícitas algumas leis de produto que continuam necessárias: isolamento live/evaluation, linhagem de fontes copiadas sem suporte independente, distinção claim/interpretação/decisão/efeito/settlement, read sets incluindo predicados/ausência, e limite do único writer por World/epoch. A capacidade estar mapeada não preserva automaticamente essas proibições. Recomendo um pequeno registro **ativo** dos invariantes preservados e das alterações deliberadas, ou uma incorporação explícita das seções semânticas pertinentes. Não reativar a organização antiga nem milhares de pseudoplanos. Esse registro pode indicar quais leis são aplicáveis a cada incremento.

2. **Média — bootstrap sem World não está especificado.** architecture.md:71 descreve commit “por World”, enquanto a primeira jornada cria o World. Acrescentar que genesis usa a mesma implementação de commit, com chave pré-World `(principal, CreatePersonalWorld, operationId)` e criação atômica de World/membership/head/receipt/outbox. Para demais mutações, explicitar escopo idempotente `(World, principal, operação, operationId)` e ausência do transporte nessa chave. Evita um agente low inventar bootstrap privilegiado ou deduplicação diferente em web/CLI. Os detalhes de locks/read set podem ficar no contrato da tarefa, mas devem existir antes de ready.

3. **Baixa — “Nenhum banco paralelo para app, Eve ou conectores” é ambíguo.** architecture.md:81 deve dizer “nenhuma autoridade/política/reconciliação paralela”. Eve precisa de journal de interação; canais, de estado de entrega; jobs, de leases/progresso. São estados próprios legítimos, com roles/processos apropriados e sem autoridade sobre o domínio, podendo começar no mesmo PostgreSQL. A redação atual pode levar a proibir essa persistência ou misturá-la indevidamente no modelo de autoridade.

Observação de implementação para o contrato de commit: “Retry é limitado” deixa o parâmetro em aberto. Preservar o limite normativo anterior de três tentativas de retry por serialização/deadlock, ou registrar mudança deliberada. Não usar Schedule como autorização para repetir efeitos externos nem renovar consentimento.

Os pontos positivos materiais são: Basis interno separado da projeção pública; revalidação em replay/emissão; presença sem membership; ausência de atomicidade fictícia S3/SQL; scripts sem sucesso vazio; testes reais por camada; responsabilidade exclusiva de composição e migrações; declarações explícitas de que CI/branch protection/produção ainda não estão implementados. O parecer é sobre desenho e **não aprova código ou capacidade futura**.

## Releitura após correção — 2026-09-05

**Os três achados foram resolvidos no desenho.** Li integralmente `docs/invariants.md` e confirmei suas referências ativas em AGENTS, README e arquitetura. O registro preserva INV-01–INV-24, inclui as distinções semânticas antes omitidas e estabelece precedência sobre pacotes de trabalho. Genesis está explicitamente no commit comum, com escopo pré-World e criação atômica; a chave posterior não inclui transporte. A arquitetura agora permite journal, transporte e leases próprios sem criar autoridade paralela.

O limite foi fixado em **três tentativas totais** de transação. Conferi a referência específica `docs/specs/spec-003.md:20`, que diz “up to 3 attempts”; portanto a redação nova elimina a ambiguidade entre tentativas e retries. O limite exclui envio externo ambíguo e não altera consentimento.

Não permanecem pendências dos achados desta revisão. A confirmação é de resolução documental, sem validação de comportamento, segurança executada ou aprovação de produto futuro.
