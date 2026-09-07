# EX15: interrupção independente do executor

Esta prova usa PostgreSQL e S3 reais do perfil `.env.infra`, signup Better Auth real e processos Node distintos. O filho carrega o build de produção do executor e dos adapters; somente configuração e acknowledgement pertencem ao harness. Rode `pnpm build` antes de `pnpm test:integration tests/integration/worlds-corrections-independent/process-atomicity.EX15.integration.test.ts`.

## Fronteiras observadas

1. O pai cria uma conta real e um World pelo executor. Preserva documento, operationId, credencial, configuração e identidade de instalação em um arquivo temporário 0600, idêntico entre reinícios.
2. O papel de migração do fixture segura `LOCK TABLE jobs.outbox IN SHARE MODE`. O primeiro filho usa os papéis normais de authority/identity. `pg_locks` confirma seu INSERT esperando `RowExclusiveLock`: as escritas de estado e receipt já aconteceram dentro da transação, sem COMMIT. O pai observa ausência de todas as publicações, envia SIGKILL, confirma a terminação por esse sinal e libera o lock. SQL continua sem claim, evidence, pin, source, operação, receipt, outbox ou avanço de revisão da importação.
3. A captura S3 prévia permanece `uploaded`, sem publicação em autoridade. Isso é esperado: a transação semântica não pretende ser ACID entre PostgreSQL e S3.
4. Um segundo filho recebe o mesmo arquivo, executa a mesma importação e sinaliza que o executor retornou, retendo o acknowledgement do teste. SQL confirma exatamente uma publicação completa e revisões 1. O pai lê o receipt persistido e mata o filho por SIGKILL.
5. Um terceiro filho reinicia com os mesmos bytes/opID. O resultado reconhecido é exatamente o receipt persistido. Estado, operação, receipt, outbox e revisões permanecem únicos; o arquivo de entrada continua idêntico.

## Limites e execução

A barreira anterior ao COMMIT é um lock real de PostgreSQL, sem hook ou mock de produção. A posterior é o canal de acknowledgement deste harness, depois do retorno do executor; não representa uma perda de pacote HTTP em ponto arbitrário. A prova cobre uma importação D01 com um registro. Não prova todos os pontos de falha, crash/restart do servidor PostgreSQL ou S3, limpeza de órfãos, restore, apagamento, cloud ou exatamente uma vez para efeitos externos.

Em 2026-09-05, sobre a composição `a14ce3c` e a revisão EX13 `6e529ff`, o teste passou com Node 24.20.0 e os serviços reais locais. O build passou. Typecheck e lint do harness foram verificados também com os diretórios `dist` temporariamente ausentes; a etapa de qualidade não depende de build prévio.

Duas falhas iniciais pertenciam ao harness: o driver reporta terminação SIGKILL como erro de `exitCode` (agora o sinal é verificado explicitamente), e um backend PostgreSQL bloqueado só observa o socket morto depois de liberar o lock (agora a liberação sucede à morte confirmada do cliente). Os oráculos semânticos zero/um e igualdade de replay não foram alterados. Nenhuma alteração de produção foi necessária.
