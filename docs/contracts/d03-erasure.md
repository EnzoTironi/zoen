# D03 — contrato candidato de supressão, erasure e restore

Status: proposta para revisão. Não é contrato admitido, operação disponível,
permissão concedida, migração ou evidência de funcionamento. Não autoriza EX24
nem altera o perfil de Worlds existentes. As decisões pendentes abaixo precisam
ser congeladas antes de tickets executáveis, write allowlists e oráculos finais.

## Autoridade e fatos atuais

Esta proposta se subordina a `docs/invariants.md`, em particular às regras de
reautorização tardia, transação local, identidade de intenção, resultado externo
Unknown, pins, fencing de escritor e retenção/restore. Os contratos atuais de
sharing e disclosure continuam vigentes. O mesmo executor semântico atende
humano, CLI, HTTP, mini app, SDK e MCP.

| Fato verificado no candidato atual | Consequência |
| --- | --- |
| `DataPolicySchema` em `packages/authority/src/ports/d01/context.ts` exige `d01-local-retained-v1`, `erasure:false`, `restoreAfterErasure:false`, `retention:'while-pinned'` | Não há autorização para apagar dados desses Worlds. |
| Esse perfil também exige `admitted-non-sensitive`, `live`, `legalHold:false` e `licensedExpiry:false` | Ausência de suporte a hold ou expiração licenciada não permite ignorá-los. |
| A autorização de World verifica membership, perfil e emergency deny | Não existe hoje lifecycle admitido de erasure de World. |
| O armazenamento admite referências a versões específicas | Apagar somente a versão corrente ou criar delete marker é insuficiente. |
| Há SDK com comandos de versões, multipart, retention e replication | Superfície do SDK não prova compatibilidade do RustFS instalado, grants ou semântica real. |
| Não foi qualificado aqui um catálogo completo de backups nem um testemunho independente de rollback | Conclusão de erasure e restore após erasure permanecem bloqueados. |

Nenhum experimento novo de erasure foi executado para produzir este documento.
As referências a comandos e mecanismos descrevem desenho a provar.

## Escopo candidato e admissão

Propor um perfil novo, com identificador e versão ainda a congelar, admitido
somente na criação de novos Worlds após todos os gates aplicáveis. O perfil
retido atual permanece intacto. Migrar Worlds antigos exigiria uma operação,
política e consentimento próprios, fora desta proposta.

A unidade candidata é o World inteiro. A intenção de seu owner encerra seu
conteúdo para todos os principals: Frames atuais e retidos, Questions,
correções, grants de conteúdo, importações e objetos admitidos ou staged que
pertençam ao World. O escopo inclui versões órfãs identificadas sob seu namespace.
Não inclui a conta, outros Worlds nem cópias já recebidas por terceiros. A
capacidade de apagar estas últimas não existe e não pode ser prometida.

A admissão precisa enumerar referências e pins entre Worlds. Nenhum cascade
pode apagar conteúdo de outro World. Relação sem regra congelada impede a
admissão ou bloqueia a execução. O novo perfil precisa dizer explicitamente
quais pins locais são superados por erasure; esta proposta não altera a lei
atual de pins por implicação. Holds legais, retenção obrigatória ou licenças
incompatíveis impedem admitir esse perfil. Não se concede bypass de Object Lock.

O produto deve distinguir três afirmações:

- **Acesso fechado:** o executor recusa novos acessos e escritas de conteúdo.
- **Supressão durável:** a intenção irreversível está em testemunho qualificado
  fora das fontes cujo rollback poderia ressuscitar o World.
- **Purge concluído:** foram removidos os dados e todas as cópias controladas
  cobertas pela política, com evidência verificável.

DELETE SQL, VACUUM e exclusão de versão S3 não demonstram destruição forense de
mídia. MVCC, WAL, backups e volumes podem conservar bytes. Se a política exigir
apagamento físico ou prazo regulatório que o provedor não prove, o perfil fica
bloqueado. Não há aqui KMS por World nem proposta de chamar exclusão comum de
apagamento criptográfico.

## Operações propostas, ainda não disponíveis

`RequestWorldErasure` e `InspectWorldErasure` são nomes candidatos, não APIs
existentes. Seus schemas e códigos públicos dependem de revisão.

A solicitação carrega WorldRef canônico, operationId, versão esperada do estado
de erasure, versão da política e confirmação explícita do escopo World inteiro.
O servidor deriva prefixos e referências; nunca aceita um prefixo arbitrário do
cliente. Exige owner autenticado, presença recente segundo regra admitida e
reautorização na linearização. Viewer ou portador de link não pode solicitá-la.
Repetir a mesma intenção consulta/continua a mesma execução; reutilizar sua
identidade com outro payload conflita. Uma solicitação aceita não é cancelável.

A inspeção revela somente estado administrativo mínimo ao owner autorizado.
É necessária autoridade específica e estreita de controle de erasure depois
do fechamento: usar o gate comum de leitura de World bloquearia também a
consulta do próprio progresso. Esta autoridade não dá acesso a conteúdo,
Frames, grants antigos ou respostas históricas. Precisa passar pelo mesmo
executor e pelas regras de disclosure tardio. Conta removida exige regra
separada; não inventar um canal administrativo privilegiado.

O receipt mínimo contém identidade da operação e World, versão de política,
estado e referências de evidência não sensíveis. O retention budget desses
metadados precisa ser admitido. Não conservar valores financeiros, assunto,
conteúdo de origem ou hashes globais de conteúdo como substituto de purge.
Erasure não pode reutilizar IDs de World.

## Estado monotônico e linearização

Estados candidatos: `Active → Closing → Suppressed → Purging → Erased`.
Uma condição `Blocked` ou `Unknown` acompanha a etapa, sem reabrir acesso nem
retroceder. Não é sucesso terminal. Retentar conserva a identidade original.

1. Na transação local autorizada, verificar perfil, owner, versão esperada,
   impedimentos conhecidos e todas as referências relevantes. Gravar Closing,
   receipt administrativo e trabalho durável no mesmo commit. A mudança participa
   do fence de disclosure existente: nenhum conteúdo novo lineariza depois
   desse fechamento. Disclosures já linearizados não são retratáveis.
2. Fora da transação local, anexar a intenção ao testemunho independente.
   Confirmar identidade e persistência por resposta inequívoca ou leitura da
   mesma operação. Falha ou timeout mantém Closing e acesso fechado.
3. Somente após confirmação durável marcar Suppressed. Antes disso nenhum purge
   destrutivo pode começar. Um receipt de Closing jamais afirma que a proteção
   contra rollback já existe.
4. Fencing e drenagem comprovados de todos os escritores precedem inventário
   final e purge. SQL, objetos, índices e cópias são reconciliados por etapas
   duráveis com resultados verificáveis e retentáveis.
5. Erased exige todas as obrigações da política cumpridas, inclusive backups
   controlados, ou seu prazo de expiração verificado. Metadados mínimos e o
   testemunho negativo permanecem conforme regra admitida.

Commit local e append remoto não formam uma transação distribuída fictícia.
Uma queda entre eles deixa Closing. Append confirmado seguido de queda antes
da atualização local é reconciliado pela identidade original. Unknown de append
não permite assumir ausência nem iniciar uma operação diferente. Falha depois
de remover parte dos objetos mantém fechamento e continua o mesmo manifesto.

Replays de receipts de conteúdo, links antigos, regrant, correções e jobs
pendentes passam pelo estado atual. A supressão recusa conteúdo com o mesmo
comportamento de ocultação adotado pelo contrato vigente. Nenhum replay reativa
um World ou contorna a barreira por consultar um snapshot anterior.

## Testemunho fora do domínio de rollback

Pré-requisito candidato: registro append-only de intenções já autorizadas,
qualificado em outra unidade de rollback, administração e backup. Pode ser
PostgreSQL separado; não há serviço ou interface admitidos hoje. É uma réplica
negativa da decisão do executor, não uma segunda política ou motor de grants.

Chave estável inclui deployment namespace, realm, World e identidade da intenção.
Entradas não recebem TTL, UPDATE ou DELETE enquanto qualquer backup elegível
puder ressuscitar o World. Escritor tem apenas direitos mínimos de append e
consulta necessários à deduplicação. Consumidor de restore tem leitura.
Credenciais de conteúdo e identidade não administram o testemunho.

Outra tabela ou database no mesmo cluster não satisfaz o requisito para rollback
físico do cluster. Outro container no mesmo snapshot de host também não basta.
`pg_basebackup` cobre o cluster inteiro e requer privilégio de replicação; seu
uso e grants devem ser admitidos separadamente. [PostgreSQL: pg_basebackup](https://www.postgresql.org/docs/18/app-pgbasebackup.html).

Cada abertura após restore ou rejoin verifica identidade do deployment e um
head/corte atual do testemunho. Hash, assinatura ou sequence restaurados do
mesmo backup antigo não provam atualidade. Restaurar o próprio testemunho exige
âncora monotônica independente ou reconciliação equivalente admitida; sem isso,
quarentena. A proposta não fabrica essa âncora nem presume uma API externa.

## Purge de versões S3

Antes de verificar ausência, impedir e drenar PUT, copy, multipart e replicação
para o namespace. Fence local, timeout ou AbortSignal não provam que uma
requisição já recebida pelo servidor não completará depois. O mecanismo real
precisa ser demonstrado com credenciais, processos e armazenamento usados.

O manifesto durável enumera todas as versões e delete markers do prefixo
canônico exclusivo do World, incluindo staged e órfãos. Usar paginação completa,
sem agrupamento por delimiter, preservando ambos os cursores e os version IDs
exatos, inclusive a string `null` quando existir. [S3: ListObjectVersions](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectVersions.html).

Remover cada versão explicitamente. DELETE sem versionId em bucket versionado
pode apenas inserir um delete marker; não prova remoção do conteúdo anterior.
[S3: DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html).

Se houver batch delete, inspecionar erros por item além do status HTTP. Resultado
ambíguo exige consulta/relist e reconciliação, nunca fabricação de sucesso. Listar
ObjectsV2 ou verificar apenas HEAD corrente é insuficiente. Após purge, executar
varredura completa vazia e GET das versões conhecidas com ausência comprovada.
Manifesto final só vale depois do fencing demonstrado. Objeto tardio invalida a
conclusão e abre reconciliação visível; não é descartado do relatório.

Multipart incompleto, replicação, lifecycle, retenção, legal hold e permissões
são parte da qualificação real do storage. Comando disponível no SDK não é
admissão do servidor. AccessDenied, hold ou incompatibilidade produz Blocked;
não se adiciona bypass ou permissão administrativa silenciosamente.

## Backups e restore fechado por padrão

Inventariar cópias SQL lógicas, base backups, WAL, snapshots de volumes, réplicas
S3, backups de identidade, índices, logs persistentes, arquivos temporários e
exports controlados. Registrar proprietário, unidade de rollback, localização,
retenção, mecanismo real de remoção e evidência. Cópia desconhecida impede
conclusão. Memória transitória exige drenagem dos processos pertinentes.

Um dump compartilhado contém outros Worlds; apagar uma linha no catálogo não
remove seu conteúdo. Produzir backup limpo e verificá-lo antes de retirar o
antigo, respeitando a retenção dos demais Worlds, ou manter purge pendente.
Expiração deve ser observada, não inferida de configuração. O PostgreSQL possui
mecanismos distintos de dump, backup de filesystem e arquivamento contínuo;
a qualificação precisa cobrir o mecanismo realmente escolhido. [PostgreSQL: backup](https://www.postgresql.org/docs/18/backup.html).

Restore candidato:

1. Restaurar em destino isolado, sem ingress, workers, modelos, índices ou
   credenciais de escrita S3 ativas. Não confiar em readiness do backup.
2. Provar contenção do escritor antigo, inclusive requisições externas em voo.
   O escritor único inclui storage; trocar somente a conexão SQL não basta.
3. Ler corte atual e identidade do testemunho independente. Aplicar supressões
   ao SQL restaurado e reconciliar todas as versões, staged e cópias controladas.
4. Atualizar o corte diante de erasures concorrentes até um fence de ativação
   demonstrável. Watermark local antigo não é prova. Gap, ledger indisponível ou
   fonte sem cobertura mantém destino indisponível.
5. Reconciliar segurança atual. Backup de identidade pode ressuscitar logout,
   sessões e grants; invalidar sessões restauradas e exigir login recente com
   provider real, além da reconciliação admitida de revogações. Não reativar
   viewers automaticamente porque um grant estava no backup.
6. Habilitar tráfego apenas depois da evidência de todos os gates. O primeiro
   teste pode terminar offline; isso não prova PITR geral nem disponibilidade.

Nenhum RPO, RTO, prazo de apagamento ou garantia de provedor é inventado aqui.

## Pré-requisitos antes da implementação

| Gate | Evidência exigida | Situação desta proposta |
| --- | --- | --- |
| Política nova | Escopo, pins, receipt mínimo, retention e confirmação aprovados | Não congelada |
| Autoridade administrativa | Operações/schema e disclosure após Closing definidos | Não implementada |
| Testemunho independente | Topologia, grants, dedup, durabilidade e antirollback reais | Não qualificado |
| Fencing completo | Impedir conclusão tardia de todos os escritores SQL/S3 | Não provado para erasure |
| Storage | Paginação, versões, multipart, holds e replicação no servidor real | Não qualificado para purge |
| Cópias controladas | Catálogo completo, remoção/expiração verificável | Ausente como admissão |
| Restore e identidade | Quarentena, corte fresco, concorrência e sessões antigas | Não admitidos |
| Evidência independente | Oráculos abaixo executados por revisão independente | Não executados |

## Oráculos candidatos

Estes IDs são rascunho para decomposição futura, não testes entregues. Usar
componentes e processos reais, dados sintéticos apenas como entrada e nenhuma
resposta de provider fabricada.

| ID | Falha a reproduzir e evidência esperada |
| --- | --- |
| ER01 | Perfil retido rejeita solicitação; dados, pins e política permanecem iguais. |
| ER02 | Viewer, link e sessão inválida não solicitam nem inspecionam conteúdo administrativo alheio. |
| ER03 | Mesmo operationId retoma; payload diferente conflita; confirmação obsoleta não fecha o World. |
| ER04 | Corrida com disclosure antes/depois de Closing respeita linearização e não vaza replay retido. |
| ER05 | Queda após commit Closing e antes de append conserva deny, sem purge e sem receipt de Suppressed. |
| ER06 | Append aceito com resposta perdida é recuperado pela mesma identidade sem duplicar intenção. |
| ER07 | Queda após append e antes de atualizar SQL converge a Suppressed, sem reabrir conteúdo. |
| ER08 | Mais de uma página de versões, delete markers, staged, órfãos e versionId null são removidos; outro World fica intacto. |
| ER09 | Exclusão parcial/Unknown e erro individual retomam manifesto; nenhum sucesso antecipado. |
| ER10 | Hold ou retenção real bloqueia purge sem elevar grants ou ignorar o impedimento. |
| ER11 | PUT/multipart real em voo durante Closing não reaparece depois da conclusão; fencing tem prova própria. |
| ER12 | Backup pré-erasure restaurado isoladamente continua suprimido por corte externo atual antes de qualquer acesso. |
| ER13 | Testemunho indisponível, rollback dele ou namespace divergente mantém restore fechado. |
| ER14 | Erasure concorrente à preparação de restore entra no corte final; snapshot antigo não ativa conteúdo. |
| ER15 | Backup ainda controlado mantém Purging; remoção/expiração real permite conclusão conforme política. |
| ER16 | Identidade restaurada não revive sessão deslogada nem grant revogado; login e reconciliação reais são exigidos. |
| ER17 | Jobs atrasados, regrant e replays após Erased não recriam World, versões ou disclosure. |
| ER18 | Receipt e testemunho preservam apenas metadados admitidos; inventário comprova ausência de conteúdo residual controlado. |

Cada caso registra baseline reproduzível, tratamento, resultado externo real,
limitações e revisão independente. Compilação não substitui esses oráculos.

## Decisões a congelar e decomposição possível

Revisar primeiro: perfil novo e consentimento; supersessão explícita de pins;
metadados e autoridade de inspeção; serviço/topologia do testemunho; garantias
reais de storage e mídia; catálogo e política de backups; protocolo de fence de
ativação e reconciliação de identidade. Dependência não admitida é bloqueio.

Depois dessas decisões, segmentos possíveis são política/estado local,
testemunho, fencing/inventário/purge e backup/restore. Cada um precisa de ticket,
packet aplicável, write allowlist, composição executável e oráculos próprios.
Esta lista não atribui números EX, não autoriza implementação e não permite
apagar dados reais para explorar uma interface ainda desconhecida.
