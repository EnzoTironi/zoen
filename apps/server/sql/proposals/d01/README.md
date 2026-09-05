# Proposta PostgreSQL D01 — EX06

Estado: implementada e exercitada em PostgreSQL 18 real; pendente de revisão independente e integração. O integrador atribui numbering e compõe a migração real. Não aplicar automaticamente em base compartilhada.

`schema.sql` cria `identity`, `authority` e `jobs` em banco dedicado, executado pelo proprietário de migração dentro de uma transação. Não contém DROP de dados ou `IF NOT EXISTS` para esconder schema divergente. Revoga CREATE em public e CREATE/TEMPORARY de PUBLIC no banco alvo. Tabelas identity da biblioteca serão definidas somente em EX09, sem schema simulado neste incremento.

`grantD01Roles` de `grants.ts` recebe nomes de roles da configuração de instalação e usa identificadores SQL escapados. Não cria usuários nem recebe nomes do cliente. Executar como dono da migração depois do schema:

- Migração: proprietária do banco/schema, única responsável por DDL.
- Authority: SELECT/INSERT nas tabelas de domínio, UPDATE nos heads/memberships/domains e colunas de progresso necessárias; sem DELETE de claims/receipts/pins/corrections, sem UPDATE de fatos históricos.
- Identity: USAGE apenas em identity; grants das tabelas reais pertencem à qualificação de EX09.
- Progress: SELECT de jobs e UPDATE apenas de estado/fence/localização/leases, sem USAGE em authority.

As roles de runtime precisam de LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS, sem propriedade de tabelas/schema ou privilégios de CREATE/TEMP. Não usar SET ROLE fornecido pelo cliente. O helper cria banco e quatro roles UUID próprios, com passwords criptograficamente aleatórios; remove somente esses recursos após fechar os pools. Interromper o processo inteiro pode deixar recursos órfãos; não executar limpeza por prefixo enquanto outro teste estiver ativo.

## Pool e consumidores

`apps/server/src/adapters/postgres/d01/postgres.ts` exporta `makeD01PostgresLayer({ url, applicationName, maxConnections })`. A URL é `Redacted`; o retorno fornece os serviços nativos `PgClient` e `SqlClient`. O perfil conecta com limite de três segundos e verifica que o runtime não recebeu CREATE nos schemas authority/identity/jobs/public, CREATE/TEMP no banco, superuser, createrole, createdb, bypassrls ou replication. O proprietário de migração usa um pool separado, não esse perfil restritivo. Não existe repository, UnitOfWork ou autorizer paralelo.

EX05/08 usam `SqlClient.withTransaction` diretamente, definindo SERIALIZABLE ou REPEATABLE READ antes da primeira consulta relevante. O adapter não aplica retry genérico. Retornar DATE como `to_char(valid_from, 'YYYY-MM-DD')`/equivalente ou texto com DateStyle admitido e validar com LocalDate; nunca converter DATE por Date.toISOString. Valores NUMERIC/bigint continuam texto e são validados pelo Schema correspondente.

Head, membership e predicados pertencem à mesma transação de snapshot. Consultas sempre delimitam World/realm na origem. A credencial authority é confiável dentro do servidor e não é entregue a cliente; EX06 não promete RLS ou autorização por um UUID/GUC. Decisão por principal e disclosure continuam EX05/08.

## Integridade e limitações

Todas as referências físicas de domínio são compostas com World/realm, inclusive source/evidence da claim e receipt/frame/Case/correction. Domínios e tipos SQL limitam os valores definidos no handoff. Outbox leased exige owner/deadline; pending/delivered limpam ambos. Captura uploaded/admitted exige localização. Não há promessa de transação SQL+S3.

Pins têm FK real de evidence no World/realm e PK de proprietário, mas owner_id polimórfico é validado no writer EX08/13, conforme decisão de W1/root. EX06 não contará esse requisito como provado até a testemunha do writer real. JSONB continua validado com os schemas privados nomeados em escrita/leitura; constraints não fingem substituir esse parsing.

C062/C064 continuam indisponíveis. Um grant SQL para uma tabela não publica uma operação. Revogar memberships, lidar com captura expirada e bloquear contexto atual são comportamentos do executor; o schema não os infere sozinho.

## Evidência executada e limites

`pnpm test:integration apps/server/test/adapters/postgres/d01` executa dez testes contra PostgreSQL real. A suíte prova a migração das quinze tabelas de domínio/jobs, grants limitados, recusa de runtime com CREATE public/replication/proprietário de migração, FKs compostas entre World/realm/proveniência e pins, unicidade de identidade física, rollback de escrita observada e de counter após falha de FK no COMMIT. Também preserva NUMERIC com 38 dígitos, Known zero, Unknown, e datas 0001–9999 em dois fusos com DateStyle não ISO.

A testemunha de snapshot usa barreiras entre duas conexões reais: READ COMMITTED serve de controle negativo que lê head antigo e membership nova; REPEATABLE READ conserva head, membership e predicados no mesmo corte. Outra testemunha libera simultaneamente duas transações com PIDs distintos disputando a mesma identidade de claim: somente uma claim e um incremento de domínio são persistidos. Isto prova mecanismos PostgreSQL, não a semântica de idempotência do executor EX05/08.

A versão Effect RC112 executa COMMIT/ROLLBACK em finalizer com `Effect.orDie` (`effect/src/unstable/sql/SqlClient.ts`). Uma violação deferred no COMMIT conserva o SqlError original como defeito, não como falha tipada comum. O teste de atomicidade observa `Effect.exit` e verifica esse defeito antes de consultar o rollback. O consumidor EX05 trata estritamente esse caso; este adapter não envolve nem substitui `withTransaction`.

Não estão provados aqui: presença BetterAuth EX09, disclosure por principal EX05/08, transação SQL+S3, pins polimórficos no writer EX08/13, chaos/carga/certificação do produto. A numeração e o registro executável da migração continuam sob responsabilidade do integrador.

Registro de execução local em 2026-09-05: duas tentativas iniciais da testemunha de snapshot foram interrompidas após um autofix remover o segundo argumento `undefined` de `Deferred.succeed`, deixando a barreira incompleta. A correção usa `null` explícito; a prova final passou. Os bancos `ex06_69056a5cea57737a4664071c` e `ex06_a5ed5bde76823b9d21cf946b` ficaram órfãos. Root autorizou a limpeza exata após confirmar seed EX06, estado anterior à barreira, ausência de sessões e nenhuma dependência de W1. Ambos e suas quatro roles correspondentes foram removidos, com nova checagem de sessões antes de cada DROP e sem FORCE/varredura por prefixo. O resultado não apaga nem transforma as execuções interrompidas em sucesso.

Revisão independente encontrou que `NOINHERIT` não bloqueia `SET ROLE`. A admissão agora consulta `pg_has_role(current_user, role, 'SET')` e verifica também os privilégios de todas as roles alcançáveis, inclusive por associação indireta. Duas regressões PostgreSQL demonstram que ignorar a admissão permite DDL real com a role de migração, enquanto o guard rejeita essas credenciais. A suíte EX06 passou a doze testes; a correção não revoga grants de instalação automaticamente.
