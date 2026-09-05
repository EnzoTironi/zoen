# Probes reais de infraestrutura EX01

Estes testes exercitam PostgreSQL pelo `@effect/sql-pg`/`SqlClient` do Effect 4 e RustFS pelo AWS SDK S3. Não comprovam ainda a autoridade do produto, migrações de aplicação, recuperação de dados apagados ou prontidão no Fly.

Configuração fornecida pelo bootstrap em `.env.infra` ignorado pelo Git:

- `ZOEN_TEST_DATABASE_URL`: conexão de infraestrutura autorizada a criar o schema efêmero do probe e conceder acesso somente a seus objetos.
- `ZOEN_TEST_RUNTIME_DATABASE_URL`: conexão real separada de runtime, sem superuser/CREATEROLE/CREATEDB/CREATE de schema.
- `ZOEN_TEST_S3_ENDPOINT`: endpoint concreto do RustFS.
- `ZOEN_TEST_S3_ACCESS_KEY` e `ZOEN_TEST_S3_SECRET_KEY`: credenciais concretas do store de teste. O SDK recebe ambas explicitamente, sem cadeia implícita de credenciais.

O perfil S3 usa `us-east-1`, `forcePathStyle: true` e uma tentativa por requisição. Conexão/requisição têm limites de três segundos. O driver PostgreSQL também limita a conexão a três segundos. A suíte usa `it.live`, preservando os serviços de runtime reais.

O probe PostgreSQL cria um schema UUID e uma tabela. Descobre a identidade atual pela própria conexão de runtime, verifica seus atributos e concede USAGE/SELECT/INSERT apenas nesses objetos. Confirma uma gravação de controle, observa outra gravação dentro de transação que falha deliberadamente e verifica que apenas a primeira permanece. CREATE TABLE pelo runtime precisa falhar por autorização. Se CREATE indevidamente funcionar, a própria transação reverte a tentativa e o teste falha.

O probe S3 cria um bucket UUID e uma única chave UUID, grava bytes sintéticos, relê os bytes, compara tamanho e SHA-256, remove a chave e observa `NoSuchKey`/404 real. Ao terminar, remove somente essa chave e esse bucket. Não enumera nem apaga buckets, tabelas, volumes ou dados de outras execuções. Finalizadores propagam falhas de cleanup em vez de anunciar limpeza concluída.

Os arquivos usam o sufixo `*.integration.test.ts` para o projeto de integração configurado pelo root. Configuração ausente ou serviço indisponível faz o probe de disponibilidade falhar; não há skip, mock ou fallback offline.

O arquivo `connection-refusal.integration.test.ts` contém duas testemunhas negativas: reserva uma porta TCP efêmera em `127.0.0.1`, fecha o listener antes da chamada e exige `ECONNREFUSED` real de cada cliente. Nenhum listener implementa ou simula protocolo PostgreSQL/S3. As credenciais são as configuradas, o host/porta são os da prova local e o SDK deve registrar uma única tentativa. Esses testes não interrompem os containers compartilhados e não provam recuperação de uma falha ocorrida durante commit/publicação.

Interrupção de container, caso necessária em outra prova, precisa ser coordenada com o orquestrador e limitada ao ambiente efêmero correspondente. Nunca interromper um serviço compartilhado ou de produção. Interrupção abrupta pode deixar um namespace próprio para diagnóstico; isso não autoriza limpeza ampla.
