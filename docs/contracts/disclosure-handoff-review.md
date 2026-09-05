# Revisão independente — handoff executor/HTTP da cerca

Candidato para congelamento; não implementa nem admite a cerca. Complementa [disclosure-fence.md](disclosure-fence.md). A API mínima recomendada mantém a codificação dentro do executor e entrega bytes ao callback somente depois de adquirir os gates e revalidar. No HTTP, o callback apenas constrói `HttpServerResponse.uint8Array`; o permit pertence ao Scope real da requisição e continua ativo depois do retorno do callback, até o writer Node terminar seu caminho de resposta.

## Assinatura proposta

```ts
readonly executeWithEmission: <A, E, R>(
  credential: Redacted.Redacted,
  requestBytes: Uint8Array,
  emit: (jsonBytes: Uint8Array) => Effect.Effect<A, E, R>
) => Effect.Effect<A, D01Error | E, R | Scope.Scope>;
```

Essa é interface proposta, não símbolo já instalado. O callback é código confiável do adapter; não é fornecido por documentos, conectores ou usuários. Ele recebe somente os bytes da resposta já validada. Não recebe request context, principal, policy ou um DTO antecipado.

Refuto a variante em que o callback recebe o DTO para codificá-lo **antes** do gate: ela já entrega o conteúdo a um consumidor antes da autorização final. Também não usar `execute(...).flatMap(encode)` como implementação do método novo: o método atual retorna o DTO antes de o transporte estabelecer a cerca. Compartilhar as etapas internas do executor, sem chamar sua interface antiga como preparação pública.

A implementação interna deve continuar selecionando a família antes de analisar o request. A rota de correções usa o mesmo mecanismo, com a família de correções e seu schema de sucesso; se também estiver no escopo da promessa, precisa de um ponto de entrada equivalente, por exemplo `executeCorrectionWithEmission`. Não permitir que uma rota escolha outra família por um campo arbitrário do payload.

## Sequência concreta

1. Capturar o Scope de invocação, analisar o envelope pela família correta, verificar presença e executar a operação existente. Manter deadline original e contexto apenas dentro do executor.
2. Validar o sucesso da família (`D01Success` ou `CorrectionSuccess`) antes de entregar qualquer valor. Reusar `canonicalJson`, já executado hoje para validar Unicode e medir a resposta; guardar seu `Uint8Array` em vez de descartá-lo. Validar o teto sobre esses bytes efetivos. Não transformar esse passo em outra canonicalização de intenção.
3. Adquirir gates compartilhados no Scope capturado da requisição, com a ordem/chaves e liberação do contrato principal. Não fechar esse Scope dentro do método. Nenhuma transação semântica fica aberta durante a emissão.
4. Sob os gates, chamar a mesma função interna de revalidação usada pelo executor: presença real, identidade da sessão/principal/realm, contexto/deadline e `authorizeWorld`. Para criação de World, resolver o World a partir do resultado já validado. Não manter uma cópia das regras no HTTP.
5. Somente agora chamar `emit(jsonBytes)`. O callback HTTP constrói uma resposta em buffer e retorna. Os gates continuam adquiridos; retornar `A` não executa o finalizer.
6. `HttpApiBuilder` reconhece a `HttpServerResponse` e não recodifica seu sucesso. O writer Node escreve a resposta; o Scope HTTP fecha depois desse efeito, liberando os gates mesmo em falha/interrupção. Cleanup e descarte ambíguos continuam requisitos do contrato principal.

Não envolver os passos 3–5 em `Effect.scoped` nem em `acquireUseRelease` cuja região de uso termine com o callback. Ambas as formas liberariam o gate antes do `handleRaw` entregar a resposta ao writer. Um timeout no método tampouco deve ser descrito como timeout do envio posterior.

## Encaixe HTTP mínimo

O seguinte trecho ilustra a parte que foi checada por tipos. Leitura limitada do request, audiência e timeout já existentes continuam etapas anteriores na rota.

```ts
handlers.handleRaw(
  "execute",
  ({ request }) =>
    Effect.gen(function* executeRequest() {
      const requestScope = yield* Scope.Scope;
      const requestBytes = yield* readJsonBody(request);
      return yield* executor
        .executeWithEmission(
          Redacted.make(request.headers.cookie ?? ""),
          requestBytes,
          (jsonBytes) =>
            Effect.succeed(
              HttpServerResponse.uint8Array(jsonBytes, {
                contentType: "application/json",
                status: 200,
              })
            )
        )
        .pipe(Scope.provide(requestScope));
    }),
  { uninterruptible: false }
);
```

`Scope.provide(requestScope)` é explícito para documentar o dono. `handleRaw` já admite requisito de Scope e o builder o retira dos requisitos da Layer, pois o servidor fornece um por requisição. Não fabricar outro Scope no adapter nem guardar o Scope da construção da Layer.

A resposta raw pula o encoder automático de sucesso; por isso a validação/codificação anterior no executor é obrigatória. Erros `D01Error` anteriores ao retorno da resposta continuam no canal de erro e usam o encoder de erro existente do builder. O Content-Type externo permanece `application/json`, inclusive quando `EvidenceOpened.mediaType` descreve CSV dentro do envelope.

`HttpServerResponse.schemaJson(D01Success)` também existe e compila, mas chamá-lo no callback após adquirir o gate recolocaria a codificação dentro da região protegida. Usá-lo num callback anterior ao gate exporia o DTO cedo. A escolha mínima é manter bytes no executor e usar o construtor puro `uint8Array` no adapter. Não importar HTTP dentro do pacote de autoridade apenas para obter esse construtor.

## Contexto e Scope não são só tipos

O executor atual captura `Effect.context<...>()` na construção da Layer. O parâmetro genérico restringe o tipo, não o conteúdo runtime. Antes de prover esse contexto às etapas de requisição, aplicar `Context.omit(Scope.Scope)`; o próprio `HttpApiBuilder.group` faz isso. Capturar o Scope da chamada antes de qualquer `provide` e prover esse Scope real na aquisição elimina a ambiguidade restante.

Não envolver o callback do consumidor num `Effect.provide(dependencies)` abrangente que sobrescreva seus serviços arbitrários. Prover dependências do executor nas suas próprias etapas, preservar `R` do callback e manter o Scope de requisição explícito. Não exigir `Scope` só na assinatura e depois usar o Scope antigo escondido no contexto.

## O que `execute` antigo pode prometer

Preservar `execute` é possível como API de compatibilidade em processo, compartilhando preparação e revalidação internas. Seu retorno de DTO não fornece uma cerca para escrita HTTP/SDK posterior. Um `Effect.scoped(executeWithEmission(..., Effect.succeed))` fecha o gate antes de o consumidor externo receber o resultado da execução; não pode ser apresentado como proteção da entrega ao `await` ou de uma transmissão subsequente.

A fronteira limitada desse caminho deve ser explicitamente a produção do resultado em processo, e não a emissão de rede. Todo adapter abrangido pela promessa de não emitir depois de revogação usa o método de emissão e seu Scope próprio. Se o produto exigir a mesma promessa para o recebimento efetivo do DTO em processo, a assinatura antiga sem Scope/callback não é suficiente: isso requer alteração de contrato, não um wrapper que esconda o fechamento.

## APIs nativas e limite temporal

Foi encontrado um accessor público não enumerado na investigação anterior: `NodeHttpServerRequest.toServerResponse(request): node:http.ServerResponse`. Também existe `toIncomingMessage(request): node:http.IncomingMessage`. Usar esses accessors quando for necessário observar o objeto Node; não acessar `resolvedResponse` privado nem fazer cast de `HttpServerRequest.source` para ServerResponse.

Acesso ao ServerResponse permite instrumentar eventos reais e construir uma adaptação Node explícita, mas não cria um hook Effect de autorização dentro de `end`. `finish` e `prefinish` não são pontos adequados para rejeitar um corpo antes de entrega. Substituir métodos do ServerResponse ou escrever bytes manualmente seria outra adaptação, com responsabilidade por headers, erros, desconexão e dupla resposta; não faz parte da API mínima proposta nem foi validado como transporte de produção.

O código instalado chama `writeHead` e `end` para corpos `Uint8Array`. Com menos de 1 MiB, retorna `Effect.void` após `end`; com exatamente 1 MiB ou mais, espera o callback de `end`. O limite publicado de resposta é inclusivo em 1.048.576 bytes. Não reduzir silenciosamente esse teto para satisfazer o ramo rápido: o ramo do limite mantém o Scope por mais tempo e precisa de prova própria, sem afirmar duração máxima. O requisito de revogação é manter o gate **pelo menos** até retorno de `end`, e não liberá-lo exatamente nesse retorno.

Gates ordenam escritores coordenados; não suspendem o relógio. Nesta proposta mínima, expiração e deadline são conferidos na última revalidação antes do callback. Não afirmar que estavam válidos no instante posterior de `end`, em `finish`, na recepção do cliente ou por um limite absoluto de 30 segundos. Um callback ou middleware que espere depois da revalidação amplia esse intervalo, mesmo que a revogação continue ordenada pelo gate.

`HttpEffect.appendPreResponseHandler` pode aproximar a última checagem do writer. Se adotado, receberá uma closure do executor que chama a mesma revalidação; não uma política reimplementada no HTTP. Seu tipo só aceita `Effect<Response, HttpServerError>` sem ambiente, portanto a closure precisa capturar/prover dependências e mapear `D01Error` para uma resposta pública antes do writer. Não converter erro de domínio por cast. Mesmo esse hook ainda precede `handleResponse/end`; sua existência não autoriza alegar limite temporal absoluto. A API mínima não precisa acrescentar esse callback enquanto a promessa temporal estiver limitada à última revalidação.

## Referências instaladas verificadas

| Arquivo / símbolo | Evidência relevante |
| --- | --- |
| `effect/src/unstable/httpapi/HttpApiBuilder.ts:142–145` | `group` omite Scope do contexto capturado. |
| Mesmo arquivo, `handleRaw:316`, `handlerToHttpEffect:810–837` | Aceita Response raw, retorna-a antes do encoder de sucesso, preserva encoder de erro no pipeline. |
| `effect/src/unstable/http/HttpServerResponse.ts:164` | `uint8Array(body, options): HttpServerResponse`, construção síncrona. |
| Mesmo arquivo, `schemaJson:338` | Encoder de schema retorna `Effect<HttpServerResponse, HttpBodyError, RE>`. |
| `effect/src/unstable/http/HttpEffect.ts:36–113,160–169` | `toHandled`/Scope englobam writer e fecham depois; wrapper externo não interrompível. |
| Mesmo arquivo, `PreResponseHandler:178`, `appendPreResponseHandler:189` | Contrato público do último hook antes do writer. |
| `@effect/platform-node/src/NodeHttpServerRequest.ts:21,31` | Accessors públicos IncomingMessage e ServerResponse. |
| `@effect/platform-node/src/NodeHttpServer.ts:579–586` | Diferença do caminho de bytes abaixo/no limite de 1 MiB. |
| `effect/src/Scope.ts:310`, `Context.ts`, `Schema.ts` | `Scope.provide`, `Context.omit`, `Schema.fromJsonString` e `Schema.resolveAnnotations` públicos. |

## Probe e pendências de prova

Um probe privado TypeScript, usando o tsconfig estrito do workspace e Effect/platform-node 4.0.0-rc.112 instalados, compilou sem erros: assinatura genérica acima, uso no `ApplicationApi`/`handleRaw`, `Scope.provide`, `Context.omit`, `Schema.fromJsonString(D01Success)`, `schemaJson`, `uint8Array`, os dois accessors Node e o tipo do pre-response hook. Não implementou um gate, não executou SQL/HTTP nem simulou sucesso de revogação. É verificação de tipos/APIs, não aceitação.

Antes de admitir a cerca, continuam necessários os oráculos de ambas as ordens entre emissão e revogação/logout, observação independente de `end` e Scope real, interrupção e limpeza de conexão, validação do ramo de exatamente 1 MiB e ausência de DTO/bytes no callback quando a revalidação nega. Nenhum resultado deste documento substitui essas provas. A confirmação de logout sem Set-Cookie no 503 já recebeu correção e testes próprios; isso não fecha a corrida de emissão.
