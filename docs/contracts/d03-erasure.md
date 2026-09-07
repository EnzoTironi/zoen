# D03 — contrato candidato de supressão, erasure e restore

Status: candidato + **congelamento mínimo** em `docs/contracts/d03-erasure-freeze.md` (2026-09-06, tip `cae72de`). O freeze cobre ER-R01 (registro externo antes de Closing), perfil novo `d03-local-erasable-v1` só para Worlds novos, escopo World, restore-after-erasure bloqueado e Unavailable indefinido se o desfecho se perder. **Não** é admissão de purge, controlador, Object Lock, backups nem alteração de Worlds `worlds-local-retained-v1`. Revisão ER-R01–05 em `d03-erasure.review.md` (`843ddad` + `9af5eec`) permanece autoritativa para gates ainda abertos. Não autoriza EX30+ a apagar dados reais antes dos gates do freeze.

## Autoridade e fatos atuais

Esta proposta se subordina a `docs/invariants.md`, em particular às regras de reautorização tardia, transação local, identidade de intenção, resultado externo Unknown, pins, fencing de escritor e retenção/restore. Os contratos atuais de sharing e disclosure continuam vigentes. O mesmo executor semântico atende humano, CLI, HTTP, mini app, SDK e MCP.

| Fato verificado no candidato atual | Consequência |
| --- | --- |
| `DataPolicySchema` em `packages/authority/src/ports/worlds/context.ts` exige `worlds-local-retained-v1`, `erasure:false`, `restoreAfterErasure:false`, `retention:'while-pinned'` | Não há autorização para apagar dados desses Worlds. |
| Esse perfil também exige `admitted-non-sensitive`, `live`, `legalHold:false` e `licensedExpiry:false` | Ausência de suporte a hold ou expiração licenciada não permite ignorá-los. |
| A autorização de World verifica membership, perfil e emergency deny | Não existe hoje lifecycle admitido de erasure de World. |
| O armazenamento admite referências a versões específicas | Apagar somente a versão corrente ou criar delete marker é insuficiente. |
| Há SDK com comandos de versões, multipart, retention e replication | Superfície do SDK não prova compatibilidade do RustFS instalado, grants ou semântica real. |
| Não foi qualificado aqui um catálogo completo de backups nem um testemunho independente de rollback | Conclusão de erasure e restore após erasure permanecem bloqueados. |

Nenhum experimento novo de erasure foi executado para produzir este documento. As referências a comandos e mecanismos descrevem desenho a provar.

## Escopo candidato e admissão

Propor um perfil novo, com identificador e versão ainda a congelar, admitido somente na criação de novos Worlds após todos os gates aplicáveis. O perfil retido atual permanece intacto. Migrar Worlds antigos exigiria uma operação, política e consentimento próprios, fora desta proposta.

A unidade candidata é o World inteiro. A intenção de seu owner encerra seu conteúdo para todos os principals: Frames atuais e retidos, Questions, correções, grants de conteúdo, importações e objetos admitidos ou staged que pertençam ao World. O escopo inclui versões órfãs identificadas sob seu namespace. Não inclui a conta, outros Worlds nem bytes já liberados ao transporte ou cópias de terceiros. Retorno de `end` não prova recepção pelo cliente. Não se promete recolher filas de rede ou cópias que saíram da fronteira de disclosure.

A admissão precisa enumerar referências e pins entre Worlds. Nenhum cascade pode apagar conteúdo de outro World. Relação sem regra congelada impede a admissão ou bloqueia a execução. O novo perfil precisa dizer explicitamente quais pins locais são superados por erasure; esta proposta não altera a lei atual de pins por implicação. Holds legais, retenção obrigatória ou licenças incompatíveis impedem admitir esse perfil. Não se concede bypass de Object Lock.

O produto deve distinguir três afirmações:

- **Acesso fechado:** o executor recusa novos acessos e escritas de conteúdo.
- **Supressão durável:** a intenção irreversível está em testemunho qualificado fora das fontes cujo rollback poderia ressuscitar o World.
- **Purge concluído:** foram removidos os dados e todas as cópias controladas cobertas pela política, com evidência verificável.

DELETE SQL, VACUUM e exclusão de versão S3 não demonstram destruição forense de mídia. MVCC, WAL, backups e volumes podem conservar bytes. Se a política exigir apagamento físico ou prazo regulatório que o provedor não prove, o perfil fica bloqueado. Não há aqui KMS por World nem proposta de chamar exclusão comum de apagamento criptográfico.

## Operações propostas, ainda não disponíveis

`RequestWorldErasure` e `InspectWorldErasure` são nomes candidatos, não APIs existentes. Seus schemas e códigos públicos dependem de revisão.

A solicitação carrega WorldRef canônico, operationId, versão esperada do estado de erasure, versão da política e confirmação explícita do escopo World inteiro. O servidor deriva prefixos e referências; nunca aceita um prefixo arbitrário do cliente. Exige owner autenticado, presença recente segundo regra admitida e reautorização na linearização. Viewer ou portador de link não pode solicitá-la. Repetir a mesma intenção continua a mesma tentativa e retorna o mesmo receipt imutável depois da confirmação externa; reutilizar sua identidade com outro payload conflita. O resultado não passa de Closing para Erased no replay. Progresso corrente pertence à inspeção administrativa, com revisão própria. Unknown não cria outra solicitação; Stale não atualiza consentimento sozinho. Uma decisão local confirmada de erasure não é cancelável, mesmo que seu sucesso ainda não tenha sido divulgado. O ponto exato aparece no protocolo abaixo.

A inspeção revela somente estado administrativo mínimo ao owner autorizado. É necessária autoridade específica e estreita de controle de erasure depois do fechamento: usar o gate comum de leitura de World bloquearia também a consulta do próprio progresso. Esta autoridade não dá acesso a conteúdo, Frames, grants antigos ou respostas históricas. Precisa passar pelo mesmo executor e pelas regras de disclosure tardio. Conta removida exige regra separada; não inventar um canal administrativo privilegiado.

O receipt mínimo contém identidade da operação e World, versão de política e o fato imutável da solicitação decidida. Progresso e atestação atual de purge ficam separados. Referências opacas não são automaticamente não sensíveis. A retenção desses metadados precisa ser admitida. Não conservar valores financeiros, assunto, conteúdo de origem ou hashes globais de conteúdo como substituto de purge. Erasure não pode reutilizar IDs de World.

## Protocolo candidato: registro prévio e decisão local

Escolha conceitual proposta para ER-R01: registrar **a existência da tentativa** fora do rollback antes de decidir erasure localmente. Registro pendente não é supressão, consentimento, grant nem autorização para purge. Seu único efeito externo é impedir promoção a partir de um snapshot que perdeu o desfecho dessa tentativa. Se o desfecho se perder com a origem, disponibilidade é sacrificada: a tentativa permanece Unknown e o restore permanece fechado. Não se infere Abortada da ausência de uma linha em backup antigo.

Há dois estados distintos. A tentativa externa é `Registrada → Confirmada` ou `Registrada → Abortada`, com transição terminal exclusiva e identidade estável. O World local é `Active → Closing → Suppressed → Purging → Erased`; Blocked e Unknown qualificam etapas sem reabrir conteúdo. Registrada sozinha não muda Active no runtime que ainda detém a fonte atual. Em restore, qualquer tentativa Registrada não resolvida bloqueia a ativação do destino inteiro neste recorte.

Sequência proposta, todas as chamadas externas fora de transações semânticas:

1. Sob admissão operacional do epoch corrente descrita adiante, validar contexto, owner e pedido para evitar registrar trabalho arbitrário. Registrar a tentativa externa com deployment/epoch, World, principal, operationId e vínculo de intenção admitido. Essa checagem preliminar **não** autoriza a decisão futura. Unknown de registro exige consultar/repetir a mesma identidade. Sem confirmação do registro, nenhuma decisão local de erasure é permitida.
2. Na transação semântica local, revalidar presença, owner, perfil, confirmação, revisão esperada, impedimentos, writer epoch e barreira de World. Confirmar Closing, resultado/receipt imutável e outbox atomicamente. **Este commit é o ponto irreversível da decisão autorizada.** A tentativa já registrada impede que rollback que perca esse commit seja tratado como World certamente Active. Nenhuma rede ocorre nessa transação. A política nova precisa admitir esta intenção durável de purge; o worker não obtém poder genérico do ledger.
3. Replicar o fato desse commit ao registro externo com a mesma identidade. Confirmada significa que o executor atual atestou o resultado local definitivo; o serviço externo não recalcula owner, resolve Stale ou autoriza o World. Replicação de fato confirmado não é nova solicitação do usuário. Logout ou revogação posteriores não desfazem esse fato, mas continuam impedindo divulgar seu receipt a um ator sem autoridade atual. Append com decisão ainda não confirmada localmente é proibido.
4. Somente após observar Confirmada marcar Suppressed e permitir resposta de sucesso da solicitação, reautorizada pelo canal administrativo. O receipt original não é reescrito. O evento Confirmada conserva o DTO mínimo exato do receipt, inclusive sua identidade, para não reconstruir outro resultado se o SQL anterior for restaurado. Essa retenção é parte da política, não anônima. Resposta perdida permite replay exato depois de consultar o mesmo registro externo. Antes disso só se informa andamento ou Unknown, sem afirmar solicitação externamente confirmada nem purge completo.
5. Fencing/drenagem demonstrados precedem Purging. Erased exige todas as obrigações de cópias controladas cumpridas e sua atestação atual verificável.

Abortada exige prova de resultado local definitivo **sem decisão de erasure**, nunca timeout. Proposta a congelar: um registro operacional local de desfecho, mutuamente exclusivo com o commit Closing sob a mesma identidade/lock da operação. Ele não é receipt semântico de sucesso e não altera o World. Rejeição por autorização/revisão não pode deixar outro processamento dessa identidade confirmar Closing depois. Confirmar esse desfecho e espelhá-lo externamente exige a fonte ainda atual, contenção de callbacks/transações antigos e epoch válido. Backup restaurado ou worker de epoch aposentado não certifica Abortada. Sem essa prova, conservar Registrada/Unknown; não oferecer cancelamento como atalho. Ainda é decisão de desenho admitir e definir esse registro operacional.

O emissor de confirmação consulta o desfecho persistido na fonte corrente e vincula identidade, intenção e epoch. Não aceita payload do cliente como prova de commit. Duplicata idêntica é idempotente; terminal oposto é incidente, não last-write-wins. O serviço precisa demonstrar essas propriedades com grants reais. Não há assinatura, certificado ou API de fornecedor presumidos aqui.

| Timeline adversária | Resultado exigido |
| --- | --- |
| Registro externo aceito; resposta perdida antes de qualquer SQL local | Mesma identidade fica consultável. Não há purge; restore não presume ausência enquanto não resolver a tentativa. |
| Registrada; owner/sessão/revisão muda; depois começa commit local | Reautorização/revisão rejeita Closing. Só desfecho negativo definitivo pode tornar Abortada. Nenhuma entrada Confirmada pode usar a checagem preliminar antiga. |
| Registrada; commit Closing ocorre; origem se perde antes de Confirmada; restore usa backup Active | O registro permanece pendente e bloqueia ativação. Não reaparece conteúdo; sem fonte/prova independente do desfecho, a indisponibilidade pode ser indefinida. |
| Commit Closing ocorre; depois logout; depois replicação Confirmada | A decisão foi autorizada no commit e persiste. Replicação não faz nova decisão. Divulgação do receipt reautoriza e pode ser recusada. |
| Coordenador cai enquanto uma confirmação externa já enviada pode completar | A tentativa permanece conhecida; não se finaliza Abortada nem se ativa destino enquanto o resultado estiver Unknown. Perda da conexão SQL não contém a chamada externa. |
| Confirmada; resposta ao solicitante perdida; backup anterior restaurado | O corte externo inclui a supressão e deve aplicá-la antes da ativação; replay posterior revela só o receipt original ao ator atualmente autorizado. |

Este protocolo resolve os contraexemplos conceitualmente mediante um novo pré-requisito externo e uma regra explícita de indisponibilidade. Não promete resolver uma tentativa cujo único desfecho foi destruído. Não é uma transação distribuída nem torna uma segunda leitura de autorização suficiente ao redor de uma chamada remota.

## Coordenação externa e fronteira de rollback

A topologia candidata precisa de registro de tentativas, tombstones confirmados e controle operacional de epochs/admissões na mesma ordem durável qualificada, fora das unidades de rollback da aplicação. Outro PostgreSQL é uma possibilidade, não um serviço admitido. Não armazena grants nem decide domínio; registra fatos originados pelo executor e governa somente a condição operacional de executar ou promover uma fonte. Antes de cada etapa de purge, holds e impedimentos atuais continuam sendo verificados; intenção durável não concede bypass. O custo de tal coordenação requer decisão explícita de arquitetura antes de congelar o perfil.

Identidade inclui deployment namespace não reutilizável, realm, World, principal, operação e intenção. Dados e epochs não recebem TTL que permita esquecer uma tentativa ou supressão ainda relevante a backups elegíveis. A representação append-only preserva eventos e valida uma única transição terminal; não apagar ou sobrescrever eventos conflitantes. Grants de registro, finalização e promoção são distintos, mínimos e indisponíveis a clientes de conteúdo/identidade. Nenhum ator da aplicação pode restaurar o controlador e declarar seu próprio epoch atual.

Outra tabela/database no mesmo cluster falha no rollback físico; outro container no mesmo snapshot de host também não basta. `pg_basebackup` cobre o cluster inteiro e exige privilégio de replicação, a admitir separadamente. [PostgreSQL: pg_basebackup](https://www.postgresql.org/docs/18/app-pgbasebackup.html).

Hash, assinatura ou sequence do mesmo backup antigo não provam atualidade. Rollback do controlador precisa ser detectável por âncora monotônica independente qualificada. Sem âncora e procedimento real de recuperação, nenhum restore ou rejoin desse controlador pode ativar a aplicação; quarentena é o resultado. Nenhuma interface dessa âncora foi encontrada ou inventada nesta proposta.

### Recorte local possível de prova

É possível propor uma prova local sem conta cloud. Duas instâncias PostgreSQL reais: aplicação em um serviço/volume e controlador em outro serviço/volume, com credenciais administrativas separadas e catálogo de backup separado. Restaurar somente um dump lógico da aplicação em terceiro destino isolado, enquanto o controlador original permanece executando sobre seu volume atual. S3 real tem bucket versionado exclusivo da prova e inventário controlado. Nenhum dump, snapshot ou comando de restore da aplicação inclui o controlador. O teste deve demonstrar essa exclusão e a durabilidade do registro após restart do seu próprio processo sem substituir o volume.

Esse perfil cobre **restore lógico da aplicação**, não rollback de host, de volume do controlador, de ambos os serviços ou perda total da máquina. Estar no mesmo host não prova independência contra falha física desse host; ela não é alegada. O controlador local não é restaurado nesta prova. Restaurá-lo exige outra admissão com âncora; na ausência dela permanece proibido/fechado. Conta cloud ausente não bloqueia esse recorte local, mas não dispensa grants, controle de epochs, persistência, fencing, catálogo nem evidência independente reais.

Preparação deve identificar exatamente databases/volumes incluídos e excluídos, origem do dump, identidade do controlador em execução e destino de restore. Usar comandos PostgreSQL reais qualificados, sem inventar APIs de backup do provedor. Uma prova com todos os processos da aplicação efetivamente parados e sem efeito externo Unknown é um primeiro caso válido; não cobre a promoção concorrente nem a janela de PUT tardio, que têm oráculos separados.

As interfaces privadas podem implementar as semânticas concretas descritas: registrar tentativa, resolver desfecho, admitir/concluir execução, iniciar drenagem, selar origem e ativar alvo por comparação de head. Cada mutação tem identidade idempotente própria e consulta de resultado Unknown. São contratos internos propostos sob nossa autoria, não nomes de APIs de fornecedor nem permissão para implementar antes de congelar esse protocolo.

## Barreira de todo o World, permits e uploads

ER-R02 permanece mecanismo novo. O fence atual de sessão/membership não cobre World inteiro. Propor subject de World tocado por toda admissão de conteúdo, replay, escrita, job e upload. Definir uma ordem global compatível entre locks World, operação, domínio, membership e sessão antes de implementar; este texto não escolhe uma ordem incompatível com contratos existentes por conveniência. A transação de Closing precisa disputar o mesmo subject com escrituras reais de revisão, cobrindo inserção/ausência sob snapshot SERIALIZABLE antigo.

Uma admissão de conteúdo registra seu permit de World antes de poder emitir. Closing fecha novas admissões. Não é necessário retratar bytes cuja liberação já linearizou; pending anterior, inclusive callback com resultado ambíguo, impede confirmar drenagem e iniciar purge. Só ACK factual ou contenção independente de processo/transporte resolve um órfão. TTL, Scope, desconexão SQL ou exclusão administrativa de pending não provam isso.

Uploads registram reserva e dono antes do início externo; conservam o estado iniciado/conhecido/Unknown e sua identidade até reconciliação. Closing impede novas reservas e novas admissões semânticas, inclusive replay de jobs. PUT já iniciado exige contenção real da escrita e inventário posterior; a confirmação local de upload que chega depois não reabre a admissão. Nenhum caminho de staging, copy, multipart ou replicação pode ficar fora desse ciclo. O protocolo real de contenção ainda é gate bloqueante; a limpeza atual de capturas não o fornece.

## Purge de versões S3

Antes de verificar ausência, impedir e drenar PUT, copy, multipart e replicação para o namespace. Fence local, timeout ou AbortSignal não provam que uma requisição já recebida pelo servidor não completará depois. O mecanismo real precisa ser demonstrado com credenciais, processos e armazenamento usados.

A porta atual `EvidenceObjectStore.remove(ObjectLocation)` não é porta de purge: `s3.ts` colapsa ausência e versão literal `"null"` em null e omite VersionId nesse caso. Propor representação específica, sem reusar essa normalização: versão explícita opaca, versão literal `"null"` e objeto sem versionamento são casos distintos, com delete marker identificado separadamente. Suporte ao último caso exige admissão própria; não é fallback do perfil versionado.

O manifesto durável enumera todas as versões e delete markers do prefixo canônico exclusivo do World, incluindo staged e órfãos. Usar paginação completa, sem agrupamento por delimiter, preservando ambos os cursores e os version IDs exatos, inclusive a string `null` quando existir. [S3: ListObjectVersions](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectVersions.html).

Remover cada versão explicitamente. DELETE sem versionId em bucket versionado pode apenas inserir um delete marker; não prova remoção do conteúdo anterior. [S3: DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html).

Se houver batch delete, inspecionar erros por item além do status HTTP. Resultado ambíguo exige consulta/relist e reconciliação, nunca fabricação de sucesso. Listar ObjectsV2 ou verificar apenas HEAD corrente é insuficiente. Após purge, executar varredura completa vazia e GET das versões conhecidas com ausência comprovada. Manifesto distingue exclusão pedida, remoção confirmada, ausência observada e Unknown. Manifesto final só vale depois do fencing demonstrado. Objeto tardio após Erased constitui incidente de garantia: manter acesso fechado, invalidar a atestação atual e tornar o incidente observável ao ator autorizado. Preservar o receipt/evento histórico sem fingir que ainda atesta ausência atual. A remediação exige nova prova; não é retry ordinário que apaga a falha anterior.

Multipart incompleto, replicação, lifecycle, retenção, legal hold e permissões são parte da qualificação real do storage. Comando disponível no SDK não é admissão do servidor. AccessDenied, hold ou incompatibilidade produz Blocked; não se adiciona bypass ou permissão administrativa silenciosamente.

## Backups e restore fechado por padrão

Inventariar cópias SQL lógicas, base backups, WAL, snapshots de volumes, réplicas S3, backups de identidade, índices, logs persistentes, arquivos temporários e exports controlados. Registrar proprietário, unidade de rollback, localização, retenção, mecanismo real de remoção e evidência. Cópia desconhecida impede conclusão. Memória transitória exige drenagem dos processos pertinentes.

Um dump compartilhado contém outros Worlds; apagar uma linha no catálogo não remove seu conteúdo. Produzir backup limpo e verificá-lo antes de retirar o antigo, respeitando a retenção dos demais Worlds, ou manter purge pendente. Expiração deve ser observada, não inferida de configuração. O PostgreSQL possui mecanismos distintos de dump, backup de filesystem e arquivamento contínuo; a qualificação precisa cobrir o mecanismo realmente escolhido. [PostgreSQL: backup](https://www.postgresql.org/docs/18/backup.html).

### Matriz candidata de dados e retenção

Eliminar conteúdo de World compreende os locais abaixo; apagar somente S3 ou os novos receipts mínimos não resolve os dados históricos. Ordem FK e regras de pins precisam ser congeladas antes do purge. A conta permanece fora do escopo de erasure de World, mas sua cópia de segurança permanece no inventário de segurança de restore.

| Classe | Ação candidata e condição de conclusão |
| --- | --- |
| `authority.frames.visible_frame/internal_basis` | Remover Frames de todos os principals do World, com claims, labels e bases privadas; invalidar replays de conteúdo. |
| `authority.cases.question/consequence/internal_basis`, `authority.corrections.answer` | Remover Questions, decisões, respostas e relações do World após resolver pins admitidos. |
| `authority.sources/evidence/claims` | Remover labels, IDs externos, assuntos, valores, datas, digests e referências; outro World não sofre cascade. |
| `authority.receipts.result` | Remover resultados de conteúdo, inclusive consequence de correção; só o receipt mínimo específico de erasure tem retenção distinta admitida. Não transformar o replay antigo em resultado novo. |
| `jobs.captures.object_location/expected_digest` | Manter apenas enquanto necessário para inventariar/confirmar purge; depois eliminar versão, tamanho, digest e vínculos que a política não autorizar reter. |
| `authority.operations/bootstrap_operations`, `jobs.outbox` | Eliminar intenções/digests e vínculos de conteúdo após encerrar jobs; dedup de erasure migra conceitualmente para seu registro mínimo próprio, não para cópia de todas as operações. |
| Manifestos, telemetria, relatórios, índices e temporários | Conservar detalhes somente durante reconciliação e pelo prazo explicitamente admitido; depois remover de todas as cópias controladas. Não copiar conteúdo privado para um relatório permanente. |
| Registro externo e inspeção administrativa | Reter apenas identidade negativa e vínculo mínimo de owner admitidos enquanto restauração puder ressuscitar o World. Finalidade, acesso, prazo e eliminação posterior exigem política explícita. |

UUID, horário, version ID, tamanho e digest podem identificar ou confirmar dados; não são anonimizados por serem opacos. Não declarar ausência de dados pessoais sem justificar o que resta em cada classe. A atestação de purge também tem retenção admitida. Perder detalhes do manifesto antes de concluir cópias torna a evidência incompleta, não reduz o escopo prometido.

### Ativação e continuidade propostas para ER-R03

Este recorte usa epochs e admissões operacionais explícitas, sem leases que expirem como prova de segurança. Cada execução que pode ler, escrever, emitir ou iniciar efeito externo obtém uma admissão do epoch ativo antes de entrar no executor. Não é autorização de domínio; a autorização local continua obrigatória. A admissão é de uso único, vinculada à execução e à encarnação do processo, e dura até prova factual de término ou contenção. O controlador recusa reutilizar uma admissão concluída. A identidade de encarnação não pode ser recuperada do backup da aplicação: reinício/reconexão exige nova preparação e promoção, não autoinscrição com um epoch salvo no SQL. Esse vínculo precisa de mecanismo real qualificado, sem presumir segredo ou certificado existente. Processos retomados não usam readiness, credenciais de bootstrap ou permits de um backup para reentrar. O mesmo mecanismo precisa cobrir workers e callbacks em voo.

O controlador possui `Ativo(e) → Drenando(e) → Selado(e) → Ativo(e+1)` na ordem durável que também registra tentativas. Drenando recusa novas admissões e novos registros, mas permite concluir os já admitidos. Selado só existe depois de resolver os desfechos relevantes, drenar todas as admissões e provar contenção da origem, inclusive SQL, processos, transporte e capacidades de escrita S3. Sinal de vida ausente não satisfaz esse requisito. Confirmada/Abortada tardia que ainda possa chegar impede selar; a operação externa também é parte da drenagem. Epoch aposentado nunca registra novas intenções ou novos desfechos.

Procedimento candidato:

1. Destino é restaurado offline, sem ingress, workers, modelos, índices nem credenciais de escrita S3. A origem passa a Drenando. Se não for possível contê-la e resolver suas tentativas, a promoção para aqui.
2. Após Selado, obter head H e identidade atuais do controlador. Qualquer Registrada sem desfecho impede ativar o destino, mesmo se o backup não contém Closing. Aplicar todas as Confirmadas e reconciliar SQL, versões/staged e cópias. Purge pendente pode permanecer fechado; não é evidência de Erased.
3. Aplicar uma política de recuperação de segurança admitida: fonte atual que reconcilie memberships/revogações, ou o recorte conservador sem viewers descrito abaixo. Sessão restaurada não autentica o destino; usar o provider atual e presença recente é necessário mas insuficiente para um grant velho. Sem um desses recortes qualificado, o destino fica offline.
4. Registrar conclusão de preparação vinculada ao destino, epoch candidato e corte H. A ativação faz comparação/transição atômica **no controlador apenas**: origem Selada, head ainda H, nenhuma tentativa/admissão pendente, alvo preparado e mesma identidade. Divergência invalida a preparação e exige reconciliação. Não há transação conjunta com o SQL restaurado; o alvo permanece fechado se a ativação não foi confirmada. Resultado Unknown é consultado pela mesma identidade de promoção, nunca substituído por outra promoção.
5. Depois de confirmar Ativo(e+1), o destino pode obter admissões correntes; só então entra no executor e seus guards locais. É proibido ressuscitar uma execução do epoch anterior. Abertura do socket por si só não libera conteúdo: qualquer request sem admissão operacional válida é recusado.

Uma erasure concorrente à promoção tem ordem explícita: se sua admissão foi aceita antes de Drenando, seu desfecho e a drenagem entram no H obrigatório. Se chegou após Drenando, não foi admitida e só pode retentar no epoch novo. Não há registro H+1 por um escritor antigo depois de Selado. No epoch novo, a tentativa segue registro prévio e Closing local; o controlador não injeta uma supressão oculta ao executor a partir de outro writer. Leitura de H seguida de abertura sem a transição e sem admissões correntes permanece proibida.

Na partição com o controlador, não há novas admissões: o runtime recusa novos comandos, inclusive reads, replays e jobs. Uma admissão já confirmada pode ter trabalho em voo; permanece pendente até seu término/containment e impede promoção concorrente. Não se alega interromper instantaneamente PUT ou bytes já liberados. Se a resposta de admissão se perde, aquela identidade é Unknown; o runtime não começa trabalho supondo que obteve permissão. O controlador não pode esquecer esse pendente por tempo. Não há fallback offline.

### Alternativa local: owner preservado, viewers sem reabertura automática

Pode-se investigar um recorte sem ledger de todas as revogações: a autoridade é restaurada, mas o provider de identidade **atual** permanece fora do rollback, assim como o controlador. O conjunto de restore exclui o database de identidade; o runtime não importa sessões de seu dump. Isso exige provar a topologia real.

Precondições de domínio a verificar em toda a história elegível do backup: owner único e imutável, ausência de transferência/revogação/substituição do owner, principal do provider não reutilizável e realm/World estáveis. Se alguma não vale, o recorte fica bloqueado. O fato de hoje não existir operação de transferência precisa de prova do recorte admitido, não se torna lei universal. Owner de World não apagado pode então ser vinculado ao registro restaurado imutável e reautenticado no provider atual. Não restaurar contas, recuperar identidade ou privilegiar uma identidade de desenvolvimento para fazê-lo funcionar.

Nenhum viewer restaurado recupera acesso: um gate de recuperação por epoch nega esses grants, inclusive links, Frames, replays, jobs e sessões antigas, antes de qualquer disclosure. Conservar as linhas históricas para auditoria/purge conforme política, sem apresentá-las como concessões atuais nem fabricar uma revogação anterior que não foi observada. A nova política precisa autorizar explicitamente essa perda conservadora de acesso após restore.

Novas concessões exigem intenção atual do owner e vínculo explícito ao epoch recuperado. Request antigo com revision/operationId antigo não pode reativar viewer por replay. Como o backup pode ter perdido revisões maiores, **não** se reinicia silenciosamente o contador atual nem se inventa seu máximo. Uma opção conceitual é revisão composta pelo epoch externo monotônico e revisão local, com nova baseline consultável e confirmação do owner. Isso muda os contratos atuais de revision/operationId e precisa de schema, significado e oráculos próprios; não é implementação autorizada por este texto. Sem solução admitida para esse vínculo, o subrecorte só pode manter viewers fechados, sem oferecer regrant pós-restore. Não se afirma que os grants restaurados foram reconciliados.

Para inspeção administrativa **após purge**, fonte candidata é o registro mínimo Confirmada: deployment/realm/World, identidade da solicitação e receipt, principal do owner revalidado no commit e perfil administrativo admitido. Esse registro sobrevive à remoção de World/membership; a inspeção consulta identidade atual no provider e só expõe o progresso dessa solicitação àquele principal. Não consulta membership já apagada, não concede read de conteúdo, não admite transferência ou recuperação de conta. O identificador do owner retido é dado pessoal com finalidade, acesso e prazo explícitos na matriz de retenção. Conta indisponível ou principal que não pode ser autenticado não recebe uma exceção de acesso.

Esse recorte reduz a dependência de uma fonte completa de revogações, mas requer aprovação própria de perda de grants, imutabilidade do owner, epochs/revisões e retenção administrativa. Mantém-se alternativa candidata ao caminho de reconciliação completa; nenhuma das duas está admitida aqui.

| Corrida | Resultado exigido |
| --- | --- |
| Tentativa admitida em e; promoção começa antes do commit local | Drenando espera seu desfecho. Closing confirmado entra no corte; Unknown perdido bloqueia promoção. |
| Destino preparou H; controlador mudou antes da ativação | Comparação falha, tráfego continua fechado; refazer preparação para o corte admitido. |
| Ativação confirmada; resposta perdida; ingress tenta abrir | Consultar mesma promoção; nenhum comando executa sem admissão confirmada do epoch ativo. |
| Runtime perde contato depois de obter admissão; administrador tenta promover | Trabalho já admitido continua obrigação de drenagem/containment; destino não recebe epoch ativo enquanto ela estiver aberta. |
| Controlador restaurado de backup antigo | Sem âncora independente e reconciliação qualificada, nenhuma admissão ou ativação; não confiar em Ativo antigo. |

O desenho exige um serviço operacional real com essas propriedades; o atual PostgreSQL de conteúdo e os locks de disclosure não o fornecem. Escolher outro protocolo menos amplo exige prova equivalente e nova revisão. Até essa decisão, restore online de erasure permanece bloqueado, mesmo com head aparentemente fresco.

Nenhum RPO, RTO, prazo de apagamento ou garantia de provedor é inventado aqui.

## Pré-requisitos antes da implementação

| Gate | Evidência exigida | Situação desta proposta |
| --- | --- | --- |
| Política nova | Escopo, pins, receipt mínimo, retention e confirmação aprovados | Não congelada |
| Autoridade administrativa | Operações/schema e disclosure após Closing definidos | Não implementada |
| Registro/controlador independente | Registro prévio, terminal único, epochs/admissões, grants, durabilidade e escopo de rollback reais | Protocolo candidato; serviço não qualificado |
| Fencing completo | Impedir conclusão tardia de todos os escritores SQL/S3 | Não provado para erasure |
| Storage | Paginação, versões, multipart, holds e replicação no servidor real | Não qualificado para purge |
| Cópias controladas | Catálogo completo, remoção/expiração verificável | Ausente como admissão |
| Restore e identidade | Selamento/ativação por head, reconciliação de grants e sessões atuais | Protocolo candidato; fonte de segurança não admitida |
| Prova local lógica | Dump somente da aplicação; controlador real atual excluído do restore | Viável como recorte proposto, não executado |
| Evidência independente | Oráculos abaixo executados por revisão independente | Não executados |

## Oráculos candidatos

Estes IDs são rascunho para decomposição futura, não testes entregues. Usar componentes e processos reais, dados sintéticos apenas como entrada e nenhuma resposta de provider fabricada.

| ID | Falha a reproduzir e evidência esperada |
| --- | --- |
| ER01 | Perfil retido rejeita solicitação; dados, pins e política permanecem iguais. |
| ER02 | Viewer, link e sessão inválida não solicitam nem inspecionam conteúdo administrativo alheio. |
| ER03 | Mesmo operationId retoma; payload diferente conflita; confirmação obsoleta não fecha o World. |
| ER04 | Corrida com disclosure antes/depois de Closing respeita linearização e não vaza replay retido. |
| ER05 | Registro externo precede Closing; rollback pré-Closing com perda de outbox e resposta conserva tentativa Unknown e impede ativação, sem purge. |
| ER06 | Registro ou confirmação aceitos com resposta perdida são consultados pela mesma identidade; nenhuma nova intenção ou Abortada presumida. |
| ER07 | Queda após Confirmada e antes de atualizar SQL converge a Suppressed; receipt imutável e reautorização de replay preservados. |
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
| ER18 | Matriz SQL/PII, manifestos e backups demonstra eliminação ou retenção explicitamente admitida de cada classe, inclusive receipts históricos. |
| ER19 | Entre registro e commit, owner/sessão/revisão muda: rejeição local definitiva, sem Closing/Confirmada; tentativa não usa autorização antiga. |
| ER20 | Desfechos Confirmada/Abortada concorrentes ou resposta externa tardia não ultrapassam terminal único; Unknown não vence por TTL. |
| ER21 | World permit antigo, callback ambíguo e snapshot SERIALIZABLE anterior a Closing não permitem nova admissão nem drenagem fictícia. |
| ER22 | Erasure admitida antes de Drenando entra no corte de promoção; depois de Drenando não inicia no epoch antigo. |
| ER23 | Mudança de head durante preparação ou ativação Unknown mantém destino fechado até reconciliação pela mesma identidade. |
| ER24 | Partição após admissão deixa execução pendente e bloqueia promoção; não há novas admissões offline nem esquecimento por prazo. |
| ER25 | Restore lógico local da aplicação conserva controlador original fora do conjunto restaurado; tentativa perdida bloqueia e Confirmada suprime antes de ativar. |
| ER26 | Versão literal null é removida explicitamente pela porta de purge; nunca normalizada para DELETE sem versão. |
| ER27 | Objeto tardio após atestação gera incidente observável e invalida atestação atual, preservando evento histórico e acesso fechado. |
| ER28 | No recorte local conservador, provider atual fica fora do dump; owner imutável reautentica, mas nenhum viewer/link/replay restaurado obtém acesso. |
| ER29 | Regrant após restore só aceita intenção e revisão do epoch novo; revisão maior perdida não é inventada e request antigo não reativa viewer. |
| ER30 | Após remover World/membership, inspeção usa registro mínimo Confirmada + identidade atual do owner; outro principal é ocultado e a PII retida é inventariada. |
| ER31 | Restart de runtime com backup do mesmo epoch não reutiliza encarnação/admissão anterior para evitar preparação e promoção. |

Cada caso registra baseline reproduzível, tratamento, resultado externo real, limitações e revisão independente. Compilação não substitui esses oráculos.

## Decisões a congelar e decomposição possível

Resultado desta revisão: ER-R01 recebe registro externo prévio não autorizador, decisão irreversível no commit local e restauração fechada diante de desfecho perdido; ER-R03 recebe ordem de epochs, admissões, selamento e ativação por head, inclusive partição. Isso remove as duas ambiguidades de desenho sem afirmar viabilidade já comprovada. ER-R04/05 recebem separação receipt/progresso, matriz de retenção, tipo de versão específico e incidente de atestação inválida. ER-R02 explicita os pontos de integração, mas a ordem de locks e a contenção real permanecem por congelar.

Persistem decisões de produto/arquitetura: custo e alcance do controlador em toda execução; registro operacional de rejeição; disponibilidade indefinida para desfecho perdido; perfil local lógico versus recuperação de host; fonte atual de segurança ou recorte conservador sem viewers; metadados retidos e prazo. Persistem gates de implementação e evidência: serviço real de controle, grants, antirollback no escopo escolhido, barreira global, fencing de processos/S3, storage, catálogo e testes reais. Revisar primeiro: perfil novo e consentimento; supersessão explícita de pins; metadados e autoridade de inspeção; serviço/topologia do testemunho; garantias reais de storage e mídia; catálogo e política de backups; protocolo de fence de ativação e reconciliação de identidade. Dependência não admitida é bloqueio.

Depois dessas decisões, segmentos possíveis são política/estado local, testemunho, fencing/inventário/purge e backup/restore. Cada um precisa de ticket, packet aplicável, write allowlist, composição executável e oráculos próprios. Esta lista não atribui números EX, não autoriza implementação e não permite apagar dados reais para explorar uma interface ainda desconhecida.
