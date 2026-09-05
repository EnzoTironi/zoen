# Proposta PostgreSQL D01 — EX06

Estado: em implementação, ainda não executada nem aceita. O integrador atribui numbering e compõe a migração real. Não aplicar automaticamente em base compartilhada.

`schema.sql` cria `identity`, `authority` e `jobs` em banco dedicado, executado pelo proprietário de migração dentro de uma transação. Não contém DROP de dados ou `IF NOT EXISTS` para esconder schema divergente. Revoga CREATE em public e CREATE/TEMPORARY de PUBLIC no banco alvo. Tabelas identity da biblioteca serão definidas somente em EX09, sem schema simulado neste incremento.

`grantD01Roles` de `grants.ts` recebe nomes de roles da configuração de instalação e usa identificadores SQL escapados. Não cria usuários nem recebe nomes do cliente. Executar como dono da migração depois do schema:

- Migração: proprietária do banco/schema, única responsável por DDL.
- Authority: SELECT/INSERT nas tabelas de domínio, UPDATE nos heads/memberships/domains e colunas de progresso necessárias; sem DELETE de claims/receipts/pins/corrections, sem UPDATE de fatos históricos.
- Identity: USAGE apenas em identity; grants das tabelas reais pertencem à qualificação de EX09.
- Progress: SELECT de jobs e UPDATE apenas de estado/fence/localização/leases, sem USAGE em authority.

As roles de runtime precisam de LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS, sem propriedade de tabelas/schema ou privilégios de CREATE/TEMP. Não usar SET ROLE fornecido pelo cliente. O teste criará banco e roles UUID próprios, com passwords criptograficamente aleatórios; só apagará seus próprios recursos após fechar os pools.

## Pool e consumidores

`apps/server/src/adapters/postgres/d01/postgres.ts` exporta `makeD01PostgresLayer({ url, applicationName, maxConnections })`. A URL é `Redacted`; o retorno fornece os serviços nativos `PgClient` e `SqlClient`. O perfil conecta com limite de três segundos e verifica que o runtime não recebeu poder de DDL/superuser. O proprietário de migração usa um pool separado, não esse perfil restritivo. Não existe repository, UnitOfWork ou autorizer paralelo.

EX05/08 usam `SqlClient.withTransaction` diretamente, definindo SERIALIZABLE ou REPEATABLE READ antes da primeira consulta relevante. O adapter não aplica retry genérico. Retornar DATE como `to_char(valid_from, 'YYYY-MM-DD')`/equivalente ou texto com DateStyle admitido e validar com LocalDate; nunca converter DATE por Date.toISOString. Valores NUMERIC/bigint continuam texto e são validados pelo Schema correspondente.

Head, membership e predicados pertencem à mesma transação de snapshot. Consultas sempre delimitam World/realm na origem. A credencial authority é confiável dentro do servidor e não é entregue a cliente; EX06 não promete RLS ou autorização por um UUID/GUC. Decisão por principal e disclosure continuam EX05/08.

## Integridade e limitações

Todas as referências físicas de domínio são compostas com World/realm, inclusive source/evidence da claim e receipt/frame/Case/correction. Domínios e tipos SQL limitam os valores definidos no handoff. Outbox leased exige owner/deadline; pending/delivered limpam ambos. Captura uploaded/admitted exige localização. Não há promessa de transação SQL+S3.

Pins têm FK real de evidence no World/realm e PK de proprietário, mas owner_id polimórfico é validado no writer EX08/13, conforme decisão de W1/root. EX06 não contará esse requisito como provado até a testemunha do writer real. JSONB continua validado com os schemas privados nomeados em escrita/leitura; constraints não fingem substituir esse parsing.

C062/C064 continuam indisponíveis. Um grant SQL para uma tabela não publica uma operação. Revogar memberships, lidar com captura expirada e bloquear contexto atual são comportamentos do executor; o schema não os infere sozinho.
