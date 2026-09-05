# D03 — cerca de divulgação (candidato; não congelado)

Este documento propõe o mecanismo que falta entre uma leitura autorizada e a entrega de seu DTO. Não aceita D03 nem autoriza implementação. Complementa [D03 sharing](d03-sharing.md). As decisões de limite de emissão, coordenação do logout e descarte de conexão precisam ser congeladas antes do código.

## Limite observável proposto

Para as respostas JSON limitadas a menos de 1 MiB, a divulgação lineariza na entrega síncrona do corpo ao `node.ServerResponse.end`. O permit permanece adquirido até essa chamada retornar. Isso não prova `finish`, recepção pelo cliente ou apagamento de dados já entregues. Uma revogação concluída impede uma emissão que ainda não cruzou esse limite; ela não recolhe respostas anteriores.

A primeira implementação deve manter respostas privadas integralmente em buffer. Streams, SSE, multipartes e respostas grandes exigem outro contrato e outros oráculos. O limite de tamanho precisa ser verificado sobre os bytes codificados, antes de escrever headers ou corpo. Se o requisito do produto for esperar `finish`, o servidor Node instalado exige uma adaptação explícita: seu ciclo atual não fornece essa garantia por Scope.

## APIs realmente instaladas

A investigação usou `effect`, `@effect/platform-node` e `@effect/sql-pg` 4.0.0-rc.112, e Better Auth 1.7.2. Referências abaixo são a arquivos em `node_modules` do workspace; não são interfaces novas propostas.

| Fonte e símbolo | Contrato relevante |
| --- | --- |
| `effect/src/unstable/http/HttpEffect.ts:36`, `toHandled` | Recebe o efeito de resposta e `handleResponse(request, response) => Effect`; cria um Scope da requisição e envolve o processamento em `Effect.uninterruptible`. |
| Mesmo arquivo, `scoped:160–169` | Fecha o Scope depois de `handleResponse`, salvo transferência explícita. Não significa que o socket terminou de transmitir. |
| Mesmo arquivo, `PreResponseHandler:178–181`, `appendPreResponseHandler:189` | Callback recebe request e response já produzida; retorna `Effect<HttpServerResponse, HttpServerError>`. Seu tipo não admite ambiente adicional. Dependências e Scope devem ser capturados/providos explicitamente. |
| Mesmo arquivo, `scopeTransferToStream:139–155`, `toWebHandlerWith:254–287` | A transferência de Scope é para stream. Resolver uma `Response` web em buffer é entrega ao chamador, não prova de transmissão de rede. |
| `@effect/platform-node/src/NodeHttpServer.ts:509–640`, `handleResponse` | Para `Uint8Array` com menos de 1 MiB, chama `end` e retorna `Effect.void`; a partir desse tamanho espera callback. O caminho de stream também não é prova geral de `finish`. |
| Mesmo arquivo, `makeHandler:187–218` | O evento `close` interrompe a fibra apenas se `writableEnded` for falso. O `resolvedResponse` da implementação de request não é accessor público tipado. |
| `effect/src/unstable/httpapi/HttpApiBuilder.ts:142–145`, `group` | Omite `Scope` do contexto capturado. O handler executa antes da codificação em `handlerToHttpEffect:756–837`. |
| Mesmo arquivo, `getResponseEncode:1222–1229` | JSON passa por `JSON.stringify` e corpo de texto, produzindo bytes. Um gate dentro do handler não cobre sozinho essa etapa posterior. |
| `effect/src/Scope.ts:310`, `provide`; `effect/src/Context.ts`, `omit` | APIs nativas para prover o Scope correto e remover serviços capturados. O parâmetro de tipo de `Effect.context<R>` não filtra o contexto em runtime. |
| `effect/src/unstable/sql/SqlClient.ts:39–64`, `reserve` | `Effect<Connection, SqlError, Scope>` reserva conexão. `withTransaction` mantém a transação só durante o efeito recebido. |
| Mesmo arquivo, `make:141–179`, `withTransaction:237–299` | Queries usam o serviço de transação real; injetar somente a tag genérica de conexão não vincula todas as queries. A transação termina com COMMIT/ROLLBACK e fecha seu Scope. |
| `effect/src/unstable/sql/SqlConnection.ts:26–63` | `executeRaw(sql, params)` e `executeValues` operam na conexão reservada. Não há API pública de descarte físico nessa interface. |
| `@effect/sql-pg/src/PgClient.ts:362–403`, `reserveRaw` | Registra finalizer que devolve o cliente ao pool. Não executa `pg_advisory_unlock`. |
| Mesmo arquivo, `makeCancel:768–784` | Cancelamento usa outra conexão do pool e `pg_cancel_backend`, com espera limitada. Não libera lock de sessão. |
| `@types/pg/index.d.ts`, `PoolClient.release` | `release(err?: Error \| boolean): void` admite descarte. Essa capacidade é do cliente nativo; não da interface genérica `Connection`. |

Não acessar campos privados nem inventar `SqlConnection.destroy`, hook de `finish` ou serviço Effect inexistente. Uma adaptação estreita do transporte pode expor aquisição/liberação/descarte; ela não pode introduzir outra política ou outro executor semântico.

## Sequência da leitura

1. O executor existente calcula o resultado usando as mesmas regras de autorização. O DTO permanece dentro do pipeline e ainda não pode escapar para o chamador.
2. A camada HTTP codifica a resposta em buffer e valida o tamanho. O callback de pré-resposta captura o Scope real da requisição, sem substituí-lo por um Scope de construção de Layer.
3. Antes da emissão, adquire os gates compartilhados necessários, na ordem canônica: sessão e depois membership. Chaves incluem realm e os identificadores correspondentes; nunca um mutex global de todos os mundos.
4. Com os gates adquiridos, revalida sessão real, autorização, deny e geração aplicáveis, expiração absoluta e deadline original. A consulta tem que observar commits anteriores à aquisição; não pode reutilizar snapshot anterior ao gate.
5. Se autorizado, devolve a resposta privada ao `handleResponse`. Se negado, substitui por resposta pública compatível com os erros existentes antes de escrever qualquer byte privado. Erros de domínio precisam ser mapeados; não são falsamente tipados como `HttpServerError`.
6. O Scope da requisição libera os gates após o retorno de `end`. Falha, interrupção ou desconexão também percorrem cleanup. O adapter precisa manter a conexão física reservada até todos os unlocks confirmarem sucesso.

O executor atual captura contexto na construção. Ao acrescentar recursos de requisição, deve omitir `Scope` desse contexto ou prover explicitamente o Scope correto; copiar `Effect.context<R>` com tipo mais estreito não resolve. Para SDK/MCP, retornar o DTO antes de fechar o gate recria a corrida. A futura interface deve exigir Scope do chamador ou um callback de emissão dentro de Scope; isso é proposta de contrato, não API instalada. A CLI que consome esse HTTP herda o limite HTTP.

## Revogação e conexão

A revogação adquire advisory lock exclusivo de transação na mesma chave de membership, dentro da transação SERIALIZABLE existente e antes da alteração. COMMIT/ROLLBACK libera esse lock. A leitura usa o lock compartilhado de sessão porque sua vida ultrapassa a transação de leitura. Ambos devem usar o mesmo banco físico e a mesma derivação de chave.

Locks de sessão precisam de `pg_advisory_unlock_shared` na mesma conexão. Devolver conexão ao pool não os libera. Registrar cleanup somente depois da confirmação de aquisição é insuficiente: a aquisição pode ter ocorrido no backend quando a resposta se perde. O adapter deve tratar aquisição e unlock ambíguos, descartar a conexão física quando não consegue comprovar sua limpeza e nunca devolver uma sessão potencialmente travada ao pool.

Prefira `pg_try_advisory_lock_shared` com deadline e espera controlada. Não repita aquisição depois de `true`, pois advisory locks de sessão são reentrantes. Cancelar query não substitui unlock. Queda física da conexão libera locks, mas partição de rede e detecção de processo morto não oferecem prazo absoluto de 30 segundos.

Também é necessário evitar starvation do pool: N leitores podem ocupar N conexões de gate e aguardar uma segunda conexão para autorização. Congelar uma destas opções antes da implementação: pool de cerca separado e limitado, no mesmo banco/credencial, ou executar a autorização pela mesma conexão usando composição SQL pública real. Não simular contexto transacional sem BEGIN nem duplicar regras de autorização.

## Logout, deny e relógio

Membership não ordena logout. Cada emissão privada adquire também gate compartilhado por `(realm, principal, sessionId)`. O logout verificado adquire o exclusivo correspondente antes de invalidar a sessão e o mantém até comprovar a invalidação. O gate deve coordenar todos os caminhos do adapter de identidade, inclusive chamadas diretas, e não somente a rota HTTP. Não segurar uma transação semântica aberta durante chamada de identidade.

No Better Auth instalado, `dist/api/routes/sign-out.mjs:41–54` captura e registra erros de `findSession`/`deleteSession`, remove cookie e pode devolver sucesso. Portanto, HTTP 200 do provedor não basta para afirmar sessão invalidada. O adapter precisa verificar que a credencial anterior deixou de ser válida; falha de verificação não confirma logout concluído. Essa é conclusão de leitura do código, não reprodução de falha do provedor. Sessão já inválida ou desconhecida não deve revelar identidade privada.

Se identidade e autoridade usam URLs de bancos distintas, os gates ainda precisam estar num único banco de coordenação. Expor um port mínimo de cerca não concede à identidade acesso à política SQL de autoridade. Não criar banco de negócio paralelo.

Deny de emergência e mudanças de geração também precisam de escritores coordenados se participarem desta promessa de não divulgação. Alteração administrativa direta em SQL fora do gate deixa a garantia aberta e deve bloquear a admissão correspondente. Um gate opcional por mundo exige ordem canônica documentada para todos os seus leitores/escritores antes de ativação.

Tempo não espera por locks. Expiração absoluta e deadline precisam ser rechecados imediatamente antes de `end`, sem reiniciar o relógio. O timeout atual dentro do handler não cobre codificação, pré-resposta e escrita; o wrapper instalado contém região não interrompível. Não declarar um limite rígido de 30 segundos para transmissão e cleanup a partir desses mecanismos. O contrato precisa distinguir deadline de autorização, orçamento de aquisição e prazo operacional de limpeza.

## Duas ordens que os oráculos reais devem provar

**Leitura primeiro.** Preparar owner/viewer e sessão reais, iniciar resposta privada e pausar com gate compartilhado já adquirido, antes de `end`. Iniciar revogação real; observar pelo banco que ela espera o exclusivo e não concluiu. Liberar emissão, registrar `end`, liberar gate, observar COMMIT da revogação. Uma nova leitura com a mesma sessão deve ser negada. Verificar os bytes privados da resposta anterior e a ausência deles na seguinte. O ponto de pausa deve envolver componentes reais, sem resposta de serviço fabricada.

**Revogação primeiro.** Preparar leitura e pausá-la depois de calcular/codificar o DTO, antes da aquisição do gate. Concluir revogação real e registrar seu COMMIT. Retomar leitura: a revalidação sob gate deve negar, sem header/corpo privado emitido. Capturar bytes do cliente e registro independente do limite de emissão; checar apenas o retorno do executor não prova esse requisito.

Executar as mesmas duas ordens para logout com a sessão real e verificação posterior da credencial. Para expiração, atravessar a expiração entre cálculo e pré-emissão e comprovar negação. Exercitar desconexão, erro de aquisição e unlock ambíguo com observador SQL independente; a conexão não pode voltar suja ao pool. Esses são oráculos planejados, não checks já executados.

## Probes executados e alcance

Dois experimentos locais, com componentes reais, foram executados durante a investigação:

- Servidor Node Effect efêmero, JSON em buffer, finalizer no Scope e observador nativo de eventos: `handler.return → node.end.enter → node.end.return → request.scope.close → node.finish → client.read.done`. Evidência de que o Scope cobre a entrega a `end`, não `finish`.
- PgClient contra o banco local configurado, duas conexões e chave aleatória: adquirir lock compartilhado numa reserva; fechar seu Scope; observador tentou exclusivo e obteve `false`; reservar novamente a conexão e executar unlock retornou `true`; observador tentou exclusivo e obteve `true`. Cleanup explícito foi executado. Evidência de que fechar reserva devolve lock de sessão ativo ao pool.

São probes de APIs, não aceitação D03, teste de logout, prova das duas ordens acima ou benchmark. Nenhum resultado de admissão foi alterado.

## Gates antes de implementar

Congelar: limite `end` para DTOs limitados; coordenador mínimo e pool/conexão; derivação das chaves e ordem; descarte em aquisição/unlock ambíguo; caminhos de logout e confirmação independente; escopo de deny/geração; semântica de expiração/deadline; pontos de observação dos oráculos. Depois, atualizar ticket, allowlist e assembly contract aplicáveis. Só então implementar o segmento autorizado e executar as provas reais. Este documento não expande permissões nem substitui a admissão independente.
