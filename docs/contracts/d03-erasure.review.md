# Revisão independente — candidato D03.2

Revisão de `59e0d28`, `docs/contracts/d03-erasure.md`, em 2026-09-05. Resultado: **adequado como proposta com dependências explícitas; ainda não pronto para congelar um protocolo executável de erasure/restore**. Há uma contradição de linearização a resolver e mecanismos críticos ainda sem definição verificável. Nada nesta revisão admite perfil, provedor, permissão, prazo físico ou implementação.

O revisor leu as invariantes, arquitetura, contratos de sharing/disclosure, política e código de captura/GC/S3, schema SQL e receipt atuais. Consultou as referências oficiais indicadas abaixo. Não executou purge, restore ou testes novos de erasure; os contraexemplos são análises de ordens possíveis, não resultados fabricados de integração.

## Decisões preservadas corretamente no candidato

- Perfil novo somente para Worlds novos, com os gates admitidos; nenhum apagamento por mudança implícita de `d01-local-retained-v1`.
- Escopo de World inteiro, sem apagar conta, outros Worlds ou prometer recolher cópias de terceiros. Pins e retenções incompatíveis precisam de decisão explícita.
- Separação entre acesso fechado, testemunho durável e purge concluído. Nenhuma transação SQL ficticiamente engloba S3 e testemunho remoto.
- Append e exclusões ambíguas permanecem Unknown; DELETE/HEAD não viram certificados de purge.
- Testemunho em unidade de rollback independente; restore isolado e fechado sem evidência de atualidade e contenção da origem.
- SDK não qualifica RustFS. Backups desconhecidos, mídia não demonstrada, holds e APIs ausentes continuam bloqueios.

Esses limites não são achados negativos. Devem permanecer quando o desenho se tornar concreto.

## ER-R01 — bloqueante: Closing antes do testemunho não sobrevive ao rollback descrito

O candidato diz que a solicitação aceita não é cancelável e que o estado não reabre, mas primeiro confirma Closing/receipt/outbox localmente e somente depois anexa a intenção ao testemunho externo. Avisar que o receipt de Closing não prova supressão evita uma afirmação excessiva sobre o receipt; não resolve a promessa de irreversibilidade da intenção aceita.

Contraexemplo:

1. Backup B contém World Active. O testemunho externo atual não contém intenção desse World.
2. A autoridade confirma Closing, receipt e outbox e pode informar essa etapa ao owner.
3. A origem é perdida antes do append. Restaurar B remove também Closing e outbox.
4. O restore consulta corretamente o head atual externo: nenhuma entrada existe, pois nenhum append ocorreu.
5. Pelo algoritmo descrito, não há supressão para aplicar e o World pode voltar a Active. O head está fresco; não se trata de cache antigo.

ER05 cobre reinício com o commit local preservado, mas não esta perda/rollback. Retentar a mesma operação só resolve se alguém ainda conserva sua identidade/intenção; isso não pode ser presumido depois de perder justamente o banco/outbox que a guardava.

**Decisão necessária:** definir exatamente quando a solicitação é aceita e qual fato torna a negação irrevogável através de restore. Alternativas a avaliar são aceitação pública somente depois de testemunho confirmado, com semântica explícita para a etapa local ainda não aceita, ou protocolo de intenção prévia retida fora do rollback antes de um Closing que deva sobreviver a ele. A segunda alternativa precisa resolver autorização, ausência de commit local e Unknown; não é autorização para trocar a ordem de duas chamadas ingenuamente. Se Closing também deva nunca reabrir sob rollback, somente adiar o HTTP de sucesso não basta: o restore precisa conhecer toda intenção local potencialmente confirmada.

Acrescentar um oráculo específico de restore pré-Closing durante a janela anterior ao append, incluindo resposta perdida ao solicitante e perda da outbox. O autor do candidato reconheceu esta lacuna durante a revisão; o draft não foi alterado pelo revisor.

## ER-R02 — bloqueante: falta o protocolo de fechamento de todo o World e dos uploads

O fence atual não é um fence de World. [disclosure-durable.md](disclosure-durable.md) e `ports/disclosure/keys.ts` coordenam sessão e membership de um principal/World. Cada pending toca os respectivos subjects. Não há hoje uma reserva global de todos os leitores nem uma barreira de erasure consultada por todos os escritores de conteúdo.

A frase “participa do fence existente” precisa tornar-se um protocolo novo e delimitado, sem sugerir que fechar um owner ou enumerar memberships atuais basta. O desenho deve definir:

- Chave/barreira de World, ordem total com os locks existentes e qual sujeito de coordenação toda admissão de disclosure toca atomicamente. A prova SERIALIZABLE de ausência precisa cobrir inserção concorrente e snapshot antigo, como no problema já encontrado em EX22.
- Regra de Closing diante de pending anterior: ou aguarda prova de que o writer terminou/não começará, ou conserva etapa ainda não confirmada. Pending de callback que lançou não vence por TTL, Scope ou perda de conexão.
- Como classificar o dono de um permit órfão após reinício/restore. É necessária contenção independente do processo/transporte anterior antes de qualquer limpeza administrativa. Não apagar os pendentes para fazer a drenagem terminar.
- Fechamento de reserva, staging, confirmação de upload, admissão semântica, replay e jobs atrasados. Nem só o guard final de divulgação nem só o lock da membership cobre esses caminhos.
- Separação entre a divulgação administrativa mínima de progresso e a divulgação de conteúdo encerrada, sem abrir uma exceção genérica para receipts antigos.

Fato do código: `stageCapture` chama o storage fora da transação e depois confirma sua localização; o sweep de capturas expiradas reconsulta tombstones porque um PUT pode chegar após uma observação NotFound. O próprio README do adapter diz que NotFound não é fencing S3. A limpeza atual converge para órfãos não admitidos; ela não prova que não surgirá outro objeto após uma conclusão de erasure.

É aceitável manter esse gate bloqueado até qualificar o mecanismo real. Antes de tickets de implementação, fixar os pontos de registro, início externo, resultado conhecido/Unknown, contenção e retomada. Ampliar ER04/ER11/ER17 com perda de coordenador, callback ambíguo, upload iniciado antes de Closing e snapshot SERIALIZABLE antigo. Não herdar uma garantia de “todos os processos morreram” de ausência de conexão PostgreSQL.

## ER-R03 — bloqueante para restore online: head fresco precisa de protocolo de ativação e continuidade

O candidato exige corretamente um fence de ativação, mas ainda não o define. Ler o head duas vezes, ou verificar um hash antes de abrir ingress, não resolve por si só o intervalo entre a última leitura e a abertura. Tampouco uma sequência assinada do próprio backup prova que o testemunho não sofreu rollback.

Congelar antes de implementar:

1. Qual serviço/domínio durável mantém a identidade não reutilizável do deployment, a atualidade do testemunho e eventual progresso de todas as intenções relevantes a ER-R01.
2. Como a origem fica contida durante rejoin/promoção e como uma erasure concorrente é ordenada com a ativação. O destino não pode abrir a partir de um head H enquanto uma intenção H+1 já aceita permanece invisível a ele.
3. O que o runtime ativo faz quando perde a cobertura do testemunho, incluindo partições após uma admissão de restore. Definir se lê continuamente, recebe uma barreira de epoch qualificada ou permanece fechado; nenhuma dessas opções está hoje admitida.
4. O que acontece ao restaurar o próprio testemunho. Sem âncora independente e regra de recuperação, a quarentena proposta deve ser terminal para essa tentativa de abertura.

Outro PostgreSQL/container é apenas candidato de topologia: independência administrativa, de credenciais, rollback e backups exige evidência. `pg_basebackup` cobre o cluster e não permite tratar outro database no mesmo cluster como cópia externa ao rollback. [Documentação oficial do PostgreSQL](https://www.postgresql.org/docs/18/app-pgbasebackup.html).

Invalidar sessões restauradas é necessário, mas não reconcilia grants revogados no período perdido. O testemunho proposto registra erasure, não todas as revisões de segurança. A fonte atual de revogações e a regra de abertura precisam ser admitidas separadamente; sem ela, manter conteúdo fechado ou adotar outro recorte de restauração explicitamente aprovado. Login recente no provider real não prova que o snapshot de memberships está atualizado. Não introduzir recuperação de contas, transferência de principal ou novas APIs de identidade como conveniência de restore.

## ER-R04 — necessário no contrato: receipt imutável, progresso mutável e inventário de conteúdo residual

“Repetir consulta/continua a mesma execução” deve distinguir o resultado imutável da solicitação de seu progresso. O commit atual guarda o resultado em `authority.receipts.result` e o replay retorna esse mesmo resultado. Definir um receipt de solicitação que não mude de Closing para Erased no replay; o estado corrente pertence à inspeção administrativa, ou a novos eventos definidos com identidade própria. Unknown não gera uma nova solicitação, e `Stale` não renova silenciosamente a intenção.

O receipt mínimo futuro também não torna mínimos os registros históricos existentes. A matriz de purge precisa nomear, pelo menos:

| Local existente | Conteúdo/ligação que não desaparece ao apagar o objeto S3 |
| --- | --- |
| `authority.frames.visible_frame` / `internal_basis` | Claims, rótulos, assunto, referências e contexto de leitura retidos |
| `authority.cases.question`, `consequence`, `internal_basis`; `authority.corrections.answer` | Decisões e vínculos privados por principal |
| `authority.receipts.result` | Resultado histórico; ProposeCorrection contém consequence e referências |
| `authority.sources`, `evidence`, `claims` | Labels, IDs externos, assunto, valores, datas e digest |
| `jobs.captures.object_location`, `expected_digest` | Localização, versão, tamanho, digest e vínculo com principal |
| `authority.operations`, `bootstrap_operations`, `jobs.outbox` | Identidade, digest de intenção, receipt e relação com World/principal |
| Novo manifesto/testemunho/telemetria e suas cópias | Podem recriar justamente os identificadores e metadados que se pretendia remover |

Para cada classe, definir eliminação, transformação admitida ou retenção mínima com finalidade/prazo e dependências FK/pins. UUIDs, version IDs, horários, tamanho e hashes não são automaticamente anônimos; não declarar ausência de conteúdo pessoal apenas porque a referência é opaca. Um digest de domínio pequeno pode permitir confirmação por tentativa. A política precisa justificar exatamente o que permanece, inclusive o vínculo de owner necessário à inspeção administrativa.

O escopo proposto exclui a conta; backups de identidade ainda precisam entrar no inventário de cópias e no protocolo de segurança de restore, sem chamar a manutenção da conta de falha de apagamento de World. Copiar conteúdo para um novo relatório de purge e manter o relatório para sempre não satisfaz ER18.

## ER-R05 — necessário antes de qualificar purge: superfície atual não representa todas as versões

A porta atual `EvidenceObjectStore.remove(ObjectLocation)` remove uma localização específica. Em `s3.ts`, a função `version` transforma tanto ausência quanto a string `"null"` em `null`, e `remove` omite VersionId quando recebe `null`. Essa representação serve ao contrato atual de leitura/localização; **não deve ser reutilizada como enumeração exaustiva de versões a purgar**. O contrato candidato corretamente exige preservar a versão literal `"null"`; uma porta de purge precisa representá-la sem ambiguidade.

A documentação de S3 confirma versões e delete markers separados e paginação com dois marcadores; delimiter pode esconder chaves em grupos. Também confirma que DELETE sem versão pode criar delete marker em vez de remover o conteúdo anterior. Isso sustenta os requisitos do draft, não qualifica a implementação RustFS local. [ListObjectVersions](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectVersions.html), [DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html).

Separar no manifesto o que foi pedido, confirmado removido, observado ausente e ainda Unknown. A conclusão exige inventário estável após contenção real, tratamento completo de páginas/erros e cópias controladas. Não inferir a ausência de multipart/replicação/lifecycle da falta dessas operações no cliente atual; isso é propriedade a verificar no destino qualificado.

A frase “objeto tardio invalida a conclusão” merece estado e semântica próprios: violar o fencing depois de afirmar Erased é incidente de garantia, não um retry ordinário que deixa a afirmação anterior silenciosamente válida. Permanecer fechado, tornar a invalidação observável ao ator autorizado e distinguir receipt histórico de atestação atual. Não prometer ausência física futura sob capacidade de escrita ainda ativa.

Também ajustar a fronteira com terceiros: o contrato de disclosure permite bytes já **liberados ao transporte**, não apenas bytes cuja recepção pelo cliente foi comprovada. `end` não prova recepção; o perfil novo não pode prometer recolher filas de rede ou cópias já liberadas.

## Backups, PII e promessa física — gates mantidos

O catálogo proposto deve cobrir o mecanismo realmente usado: dump lógico, base backup/WAL, volumes, versões S3, réplicas, backups do testemunho, índices, temporários e exports. Os mecanismos PostgreSQL têm propriedades distintas; não são uma única API de backup. [Documentação oficial de backup e restore](https://www.postgresql.org/docs/18/backup.html).

A estratégia de produzir backup limpo antes de retirar um backup compartilhado é aceitável apenas depois de provar ambos os lados: outros Worlds continuam recuperáveis e nenhuma cópia antiga do World apagado permanece controlada fora da política. Catálogo apagado, job marcado concluído, lifecycle configurado ou VACUUM executado não provam destruição de bytes. Se mídia/replicação/retention impedir a promessa, continuar Purging/Blocked conforme contrato, sem elevar permissões ou chamar isso de apagamento criptográfico.

Esse desenho deve declarar quais alegações são ausência lógica na API, supressão mesmo após rollback, ausência nas cópias controladas e destruição física demonstrada. A proposta já evita prometer RPO/RTO/prazo regulatório; preservar isso. Não é necessário inventar KMS, fornecedor ou contrato de retenção para encerrar a revisão.

## Encaminhamento para congelamento

Antes de EX24+, root deve decidir ER-R01 e congelar o protocolo de ER-R02/ER-R03, inclusive resultado público/Unknown, administrativo pós-fechamento e órfãos. ER-R04/ER-R05 devem virar matriz e interfaces específicas com oráculos próprios; não reutilizar portas atuais por semelhança de nome.

A revisão não pede que os gates de provedores sejam declarados satisfeitos. Pede que impossibilidades e estados intermediários sejam representados corretamente, para que um ticket não trate intenção de desenho como permissão ou prova. Não há aprovação de implementação, perfil de erasure, purge real ou restore neste resultado.
