# Compartilhamento local — evidência de EX20–EX23

Em 2026-09-05, owner/viewer, grant/revoke e emissão privada estão compostos no mesmo executor usado por HTTP, Web e CLI. O perfil permanece `d01-local-retained-v1`: dados admitidos não sensíveis, sem apagamento ou restore após apagamento. Isto não conclui D03, D01/D02 integrais ou as 22 entregas.

O build local de `767f757` foi provisionado em um novo profile `sharing-v2`, na origem `http://127.0.0.1:4316`. Seu manifesto tem SHA-256 `f680f198334537bccc0f4b39b1cd55cb28eb9b73fd091506682e2b5bae799537`. Os profiles anteriores, seus bancos, buckets, configurações e evidências foram preservados; nenhum World antigo recebeu outro release digest. O build anterior `a236ebb` foi arquivado antes da parada e reconstrução, e o baseline de Web continua separado.

## Resultado observado por camada

| Camada | Evidência executada |
| --- | --- |
| Qualidade estática | TS7 e lint passaram no combinado com as correções da Web. Formatação e verificação estrutural do plano são checks separados; não contam como comportamento de produto. |
| Unidade | 198 testes em 27 arquivos passaram. Incluem requests, schemas, apresentação e leis puras; não substituem providers. |
| Integração | 166 testes em 75 arquivos passaram no combinado `5d9510e`, usando PostgreSQL/S3/Better Auth reais e os executáveis compilados de `767f757`. Incluem os 12 ordenamentos de emissão descritos abaixo. |
| Componentes | Sete cenários Chromium passaram, incluindo teclado, descarte de rascunho, negação, largura estreita e ampliação de 200%. |
| Aceitação local | Os 12 cenários de Web/CLI passaram em 2,8 minutos no profile `sharing-v2`, com testes de `1ae7a83`. |
| Imagem real | A imagem `zoen-local:container-83ef9e5fd7b9434c`, construída do código de `37b09f5`, foi provisionada com seu próprio manifesto, banco e bucket. Os mesmos 12 cenários passaram em 2,8 minutos. |

A imagem executou como usuário sem privilégios, filesystem somente leitura, sem capabilities e sem novos privilégios, no perfil já definido pelo harness. O manifesto de imagem efetivamente produzido foi `sha256:8cdd4177a21763f7fea6166a3e9561a683fe817c29251b50cd4df905d36d5487`; isso identifica o artefato local observado e não uma publicação em registry.

A prova específica [SH-05 entre processos](../../tests/integration/d03-sharing/independent/http-lifecycle.review.md) também passou em dois cenários, com repetição independente por root em `dd4f781` (4,74 s). Locks reais demonstram dois backends aguardando antes de liberar as concessões. Mesmo opID produz respostas idênticas e um único efeito; opIDs distintos produzem 200/409 Stale e somente receipt vencedor. Replay nos dois servidores após revoke mantém o resultado histórico e a membership revogada. Essa execução acrescenta duas integrações às 166 do conjunto anterior; a CI remota combinada ainda está pendente.

## Emissão, revogação e logout

A migração 006 adiciona registros operacionais de emissão pendente e fechamento de sessão. O adapter usa pool limitado, locks físicos e registro durável. O executor prepara e codifica o JSON, adquire um permit, revalida presença/capacidade e chama o writer nativo de forma síncrona. O ACK só pode remover o registro depois de `end(bytes)` retornar ou quando a tentativa já não puder chamar o writer. Scope, timeout e perda de conexão não certificam emissão concluída.

A [revisão SQL independente](../../tests/integration/d03-sharing/independent/durable-permit-snapshot.review.md) reproduziu o snapshot SERIALIZABLE antigo que via zero pendências apesar de um permit já confirmado. O protocolo corrigido toca o mesmo subject no registro e na mutação, força `40001` em snapshot antigo e reaplica o guard em uma transação nova. Foram provadas as variantes com subject existente e inicialmente ausente. A [migração independente](../../tests/integration/d03-sharing/independent/durable-migration.review.md) verificou preservação de histórico e grants, incluindo comandos proibidos para roles dos componentes.

Os [12 cenários HTTP entre processos](../../tests/integration/d03-sharing/independent/http-process.review.md) combinam OpenEvidence, Inspect atual e Frame próprio retido, com revoke/logout antes da admissão ou depois da última revalidação, dentro de `ServerResponse.end` pausado. Dois servidores reais compartilham o mesmo banco, instalação, S3 e provider de identidade. Os observers delegam as chamadas nativas e os bytes originais; não substituem os componentes.

Quando revoke vence, a resposta preparada é negada. Quando logout vence antes da admissão, seu fechamento durável pode produzir 503 na tentativa já preparada; novas requisições da sessão inválida recebem 401. No ordenamento tardio, matar a conexão física não permite confirmar revoke/logout atravessando pending. A operação concorrente retorna 503 e mantém membership, sessão e registros semânticos correspondentes. Depois do retorno real de `end` e ACK, retry da mesma intenção/cookie pode concluir; a leitura seguinte é negada.

Outras provas reais cobrem expiração durante revalidação, cancelamento antes do callback, callback que lança depois de end, DELETE de ACK negado, um pool com um slot, provider de logout com DELETE negado e conexão perdida durante invalidação. Uma resposta 200 já enviada não é transformada retroativamente em 503 quando o ACK falha. As provas de SIGKILL de grant/revoke continuam verificando membership, operação, receipt e outbox todos ou nenhum nas fronteiras de commit.

## Superfícies e falhas reproduzidas

A Web inspeciona o próprio papel, oculta ações de proprietário para viewer, confirma destinatário/revisão/audiência de todo o World e consulta acesso atual após receipt. A CLI exige UUID, operationId e revisão explícitos. A jornada real prova claims e bytes S3 exatos, Frame próprio, negações, replay de grant depois de revoke sem reativação e regrant com nova intenção/revisão.

A [revisão independente da Web](../../tests/integration/d03-sharing/independent/web.review.md) reproduziu duas falhas: uma negação ignorada enquanto outra ação estava busy e uma negação histórica ignorada depois de o Frame exibido mudar. As correções preservam o guard de sessão/World e processam a negação antes de considerar estado transitório. Os três cenários independentes passaram no build `767f757`, incluindo resposta 200 anterior entregue com atraso, Stale exigindo nova confirmação e recibo histórico seguido de consulta atual revogada. As falhas e screenshots originais foram preservados.

A aceitação anterior também detectou que limpar o World retirava a mensagem de negação. A interface voltou a apresentar o heading de negação, mantendo os dados removidos. Os testes JSON/CSV foram adaptados ao novo ponto de recusa ao abrir o World: exigem 404 fechado, ausência do formulário e uma leitura HTTP direta igualmente negada. Os oráculos de conteúdo, isolamento e logout foram conservados.

A primeira execução global de integração encontrou um timeout de subprocesso da CLI com nove workers concorrentes. Os três cenários de CLI passaram isoladamente, sem alterar o prazo de três segundos por processo. A suite de integração passou com orçamento explícito de dois workers compartilhando os serviços reais. O teste antigo de schema passou a instalar explicitamente sua baseline 001–004, mantendo as 15 tabelas esperadas; a migração atual 006 conserva seu próprio oráculo. Um conflito de autenticações simultâneas entre duas suites produziu 429 real; os cenários foram serializados respeitando o limite existente do provider.

## Limites e execução

O limite de emissão é o retorno de `end`, com JSON de até 1.048.576 bytes. Não prova recebimento pelo destinatário, recolhimento de bytes anteriores, todos os interleavings, DLP, destruição física, backup/restore ou implantação cloud. Perda do processo depois de registrar um permit pode deixar pending permanente. A segurança permanece fechada; recuperação de órfãos precisa de contenção independente e procedimento próprio, ainda não implementados. Não há TTL que autorize eliminar essa pendência.

Para reproduzir, use Node 24, instalação congelada, infraestrutura real, build e um profile novo. `pnpm test:integration` executa o conjunto de componentes e processos. `pnpm test:acceptance` exige as origens explícitas em `ZOEN_TEST_WEB_URL`, `ZOEN_TEST_CSV_WEB_URL` e `ZOEN_TEST_SHARING_WEB_URL`, além do ambiente desse profile. Não rode suites de aceitação concorrentes contra o mesmo profile por causa do limite real de signup.

`pnpm test:container` constrói uma imagem nova, extrai seu manifesto, provisiona recursos próprios e executa as 12 testemunhas na origem do contêiner. O harness conserva banco, bucket, logs e configuração locais da execução; remove somente o contêiner temporário que criou. Os logs desta rodada estão no worktree de verificação, em `.local/container-83ef9e5fd7b9434c-proof/` e nos arquivos `integration-final-20260905T2103.log`, `acceptance-sharing-v2-20260905T2106.log` e `container-sharing-20260905T2108.log`.
