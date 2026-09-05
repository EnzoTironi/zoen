# D01 — candidato de importação CSV v1

Estado: **contrato congelado para implementação por root em 2026-09-05, após revisão independente do worker 1; implementado no perfil local; alcance e gates remanescentes em [csv-local.md](../verification/csv-local.md)**. A execução depende dos pacotes EX16–EX19 e de seus donos em `planning/execution.json`. Este incremento acrescenta uma representação de entrada para `ImportEvidence`. Não cria operação, executor, autoridade, reconciliação, settlement, qualificação de fonte ou perfil sensível. CSV não conclui todo D01. O formato abaixo é o dialeto Zoen definido aqui; não promete aceitar qualquer arquivo produzido por uma planilha.

## Base observada e decisões propostas

Este candidato parte de [invariants.md](../invariants.md), [d01.md](d01.md) e do caminho executável atual: `packages/contracts/src/d01/{values,evidence,operations}.ts`, `packages/authority/src/values/{json,canonical}.ts`, `packages/authority/src/evidence/d01/{import,capture,open}.ts`, `packages/authority/src/ports/d01/storage.ts`, `apps/server/src/adapters/object-storage/d01/s3.ts` e leitores web/CLI. Nenhuma referência histórica foi necessária.

O envelope atual contém **`input.document`**, uma string com o texto JSON original; não há campo executável `documentJson`. O parser JSON estrito valida duplicatas, Unicode e limites. A importação e `intentDigest` validam o documento interno separadamente. O adapter S3 fixa `application/json` tanto no PUT quanto na conferência do GET. Acrescentar apenas um parser no frontend deixaria esses contratos incoerentes.

As escolhas congeladas são: seletor CSV explícito no envelope; versão e metadados de uma única fonte presentes no próprio CSV; colunas e ordem fixas; nenhuma detecção de dialeto/localidade; mesma projeção `ImportDocument`; retenção do CSV original e formato de storage vinculado à captura. A revisão confirmou os valores/datas publicados e a viabilidade de 200 registros válidos atingirem exatamente 262.144 bytes; a precedência de erro abaixo conserva o comportamento JSON existente.

## Envelope público e compatibilidade JSON

O envelope externo continua JSON estrito com `schemaVersion: "d01.v1"`, `operation: "ImportEvidence"`, `operationId`, `worldRef` e `purpose: "personal-records"`. `input` passa a ser uma união exata:

| Entrada | Interpretação |
| --- | --- |
| `{document: string}` | JSON legado, exatamente como hoje |
| `{document: string, format: "d01.csv.v1"}` | CSV definido neste contrato |

Ausência de `format` significa somente a representação JSON já publicada. Não detectar CSV por extensão, MIME do upload, primeiro caractere ou erro do parser JSON. CSV sem seletor é inválido; um seletor desconhecido é `InvalidInput`. Não acrescentar `format` ao envelope JSON legado antes de calcular a intenção, nem materializar defaults que mudem seus digests/replays. `EvidenceImported`, chave de deduplicação, endpoint `/api/d01/execute` e identidade `ImportEvidence` permanecem os mesmos.

O seletor não fornece metadados de fonte fora do documento: versão e source estão também nos bytes CSV retidos. Assim, alterar a origem declarada, revisão ou label altera os bytes da evidência, como já ocorre no JSON. Não há sidecar, metadado tirado do nome de arquivo, valor inferido do usuário ou segunda fonte de verdade.

## Documento CSV e cabeçalho

A primeira linha é exatamente o cabeçalho abaixo, ASCII, não citado, nessa ordem. Não aceitar colunas adicionais, ausentes, repetidas, renomeadas, reordenadas, espaços em torno dos nomes, comentários ou preâmbulo `sep=`.

```csv
schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo
d01.csv.v1,manual,bill-2026-09,1,"Fatura, setembro",row-1,invoice-1,obligation.amount,Known,100.00,BRL,DateInterval,2026-09-01,2026-10-01
d01.csv.v1,manual,bill-2026-09,1,"Fatura, setembro",row-2,invoice-2,obligation.amount,Unknown,,,Unknown,,
```

Cada registro lógico de dados tem exatamente **14 campos**. Há de 1 a 200 registros de dados; o cabeçalho não conta. `schemaVersion` deve ser `d01.csv.v1` em todas as linhas. Os quatro campos `source*` são obrigatórios em cada registro e devem ser exatamente iguais, depois de decodificar as aspas CSV, em todo o arquivo. Isto define uma única fonte/revisão por evidência e torna o documento retido autossuficiente. Diferença de label, revisão, namespace ou identidade externa dentro do arquivo é erro, nunca divisão automática em fontes.

| Campo CSV | Valor obrigatório e projeção |
| --- | --- |
| `schemaVersion` | Literal `d01.csv.v1`; a projeção interna usa o `ImportDocument` atual `d01.v1` |
| `sourceNamespace` | `SourceDescriptor.namespace` / `RecordKey` atual |
| `sourceExternalId` | `SourceDescriptor.externalId` / `RecordKey` atual |
| `sourceRevision` | `SourceRevision` atual; string declarada, sem coerção numérica ou ordenação inferida |
| `sourceLabel` | `Label` atual, 1–200 unidades de string conforme o schema existente |
| `recordExternalId` | `ImportRecord.externalId` / `RecordKey`; único no documento |
| `subjectKey` | `SubjectKey` atual, identidade explicitamente fornecida |
| `predicate` | Literal `obligation.amount`; não acrescentar default implícito |
| `valueTag` | Literal `Known` ou `Unknown` |
| `amount`, `currency` | Regras de valor abaixo |
| `validTimeTag` | Literal `DateInterval` ou `Unknown` |
| `validFrom`, `validTo` | Regras temporais abaixo |

Reusar os schemas publicados: `RecordKey` é `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`; `SourceRevision` tem 1–128 unidades de string. Não fazer trim, case folding, normalização Unicode, substituição de separadores ou tradução de nomes. Espaços que um schema textual existente permite continuam dados; não se tornam ausência. Uma string parecida com fórmula, URL ou instrução é texto não confiável, nunca código, fetch ou autoridade.

## Valores, datas e desconhecimento

- `Known` exige `amount` não vazio conforme `DecimalText` atual: sinal negativo opcional, 1–20 dígitos inteiros sem zeros iniciais indevidos e até 18 casas decimais após ponto. `currency` é exatamente `BRL`, `USD` ou `EUR`. Não passar por `Number`, arredondar, trocar vírgula por ponto ou remover zeros do texto importado. `0`, `0.00` e `-0` são valores conhecidos admitidos pelo schema; não representam Unknown.
- `Unknown` exige **ambos** `amount` e `currency` vazios. Quantia presente junto de Unknown, ou valor Known com qualquer campo obrigatório vazio, é erro. Texto `null`, `N/A`, `NaN`, `?`, uma célula vazia isolada ou ausência de coluna não declara desconhecimento.
- `DateInterval` exige as duas datas civis ISO `YYYY-MM-DD`, calendariamente válidas, anos 0001–9999, com `validFrom < validTo`. O intervalo é semiaberto: início incluído, fim excluído. Não converter para UTC, timestamp, serial Excel ou fuso do navegador.
- Tempo `Unknown` exige **ambos** `validFrom` e `validTo` vazios. Não preencher com data de upload, relógio do servidor ou intervalo de outro registro. Valor e tempo são eixos independentes: Known com tempo Unknown, ou valor Unknown com intervalo conhecido, são permitidos.

Expoente (`1e3`), decimal de localidade (`"1,23"`), agrupamento (`1.000,00`), símbolo monetário, `+1`, infinito, data `01/09/2026`, ano 0000, dia impossível e intervalo vazio/invertido falham. Aspas CSV apenas delimitam texto: não tornam esses valores válidos. A normalização decimal já existente na projeção de claims pode apresentar `100.00` como `100`; ela não muda o CSV retido nem o digest da intenção.

## Gramática, Unicode e limites

1. UTF-8 estrito, sem BOM inicial. Bytes inválidos, surrogate isolado, NUL e não caracteres rejeitados pela regra `validUnicode` atual falham antes de staging. Não substituir bytes por U+FFFD. Rejeitar também controles C0 exceto tabulação, CR e LF; tabulação é conteúdo, nunca separador. Unicode válido não sofre NFC/NFD. U+FEFF dentro de um campo textual é dado, sujeito ao schema, e não é removido.
2. Separador único: vírgula ASCII. Separadores de registros são LF ou CRLF; o arquivo deve usar uma dessas formas de modo uniforme fora de campos citados. CR isolado é inválido, inclusive dentro de aspas. Um terminador após o último registro é opcional; linha vazia extra é inválida.
3. Campo sem aspas não pode conter vírgula, aspas, CR ou LF. Campo citado começa com `"`, termina com `"` e representa uma aspa literal por `""`. Pode conter vírgula, LF ou CRLF, preservados exatamente. Depois da aspa final somente vírgula, terminador de registro ou EOF são válidos; não consumir espaços silenciosamente. Aspa pendente e aspas soltas são inválidas. Barra invertida é conteúdo literal onde o schema permitir; não funciona como escape de aspas, newline ou outro caractere.
4. Um campo vazio é o texto vazio, escrito entre separadores ou como `""`; sua validade depende da coluna. Não aceitar registros em branco, footer de totais ou múltiplas tabelas. Campos citados com quebra de linha continuam **um registro lógico**, não duas linhas de dados.
5. Limites permanecem: documento bruto até **262.144 bytes UTF-8**, envelope bruto e resposta até **1.048.576 bytes**, até **200 registros**, strings/identificadores conforme schemas atuais. O parser conta bytes antes de alocar a tabela inteira e limita registros/campos durante a leitura. O teto atual de 10.000 entradas não é ampliado: 201 linhas incluindo cabeçalho × 14 campos = 2.814 células no máximo. Nenhum parser recebe limite ilimitado porque CSV não tem profundidade JSON.
6. Um excesso detectado pelo limite de bytes do parser segue `QuotaExceeded`. A precedência existente é preservada: antes de analisar o documento interno, o schema público `DocumentText` recusa mais de 262.144 unidades UTF-16 com `InvalidInput`; por isso um documento ASCII acima desse tamanho pode falhar antes da cota interna. Um texto multibyte cujo comprimento de string ainda é admitido pode atingir a cota de bytes posterior. Violações de gramática, campos, versão, cardinalidade ou schemas seguem `InvalidInput`. A revisão reproduziu essa diferença no JSON atual; CSV não promete uniformidade de categoria que o envelope não possui. Nenhuma mensagem pública inclui conteúdo, fragmento de célula, caminho de storage ou diagnóstico livre. Recusas locais web/CLI conservam os códigos existentes; não são prova de validação no servidor.

## Normalização única e retenção

A borda de documento recebe o `input` estrito, seleciona o parser pelo formato e produz a mesma estrutura `ImportDocument` consumida pela admissão atual. Essa normalização só converte representação: mantém ordem dos registros, chaves, strings, moeda, tags e datas. Não resolve identidades, escolhe uma fonte, verifica pagamento, infere confiança ou altera unidades. O normalizador não substitui o texto original no request.

A importação e `intentDigest` devem consumir **o mesmo validador de documento**, incluindo unicidade de `recordExternalId`, em ambos os formatos. O JSON mantém seu parser de chaves duplicadas; não trocar por `JSON.parse` do documento inteiro. O digest semântico continua incluindo o envelope validado exato e a string original; no CSV inclui também o seletor explícito. O byte digest e a captura continuam sobre os bytes UTF-8 originais do documento, sem serializar a projeção JSON.

Para UTF-8 válido sem BOM inicial, decodificação estrita que preserve os caracteres e posterior codificação produzem os mesmos bytes. Nenhuma ponta converte CRLF/LF, remove a última quebra, limpa células, altera aspas ou reescreve espaços. Os testes devem comparar bytes reais retidos, além da equivalência de claims.

O pipeline permanece: presença e autorização/política atuais → validação → reserva/captura S3 real → commit local de evidence, claims, pin, domains, operação, receipt e outbox. Não há I/O S3 dentro da transação semântica nem banco CSV separado. A falha de um registro rejeita o documento inteiro antes de staging; não importar parcialmente linhas válidas. Mesmo CSV/revisão/bytes sob nova operação pode reutilizar a evidence atual, como JSON; não cria novos claims por isso. Mesmo source namespace/identidade/revisão com bytes diferentes é `Conflict`, inclusive mudança de aspas, newline ou representação JSON↔CSV. Não inventar outra revisão para evitar esse conflito. Cópias não adquirem suporte independente (INV-04).

`VisibleClaim.recordIndex` continua índice **lógico de dados**, começando em zero, sem incluir cabeçalho. `recordId` é o `recordExternalId`. Com `evidenceRef`, formato retido e documento exato, essa coordenada identifica o registro sem afirmar um número de linha física falso quando há campos multilinha. Não é necessário acrescentar byte spans públicos neste incremento.

## Handoff de formato no storage e leitura

O adapter atual aceita apenas `application/json`; não gravar CSV com esse MIME nem enfraquecer o GET para aceitar qualquer tipo. Proposta física para congelamento:

- Acrescentar `jobs.captures.document_format text COLLATE "C" NOT NULL DEFAULT 'd01.json.v1' CHECK (document_format IN ('d01.json.v1','d01.csv.v1'))`. Reserva/lock/admissão conferem o formato esperado junto de World, digest, tamanho e fence. O formato não é um grant nem identifica a fonte.
- `CaptureReservation` passa a carregar `documentFormat`. `EvidenceObjectStore.stageDocument/locateDocument` recebem esse formato obrigatório; só a borda admitida o escolhe. Os métodos `stage/locate` conservam a assinatura JSON anterior, verificada pelo oráculo de tipo EX02. O adapter implementa os pares pela mesma rotina de S3: métodos legados preservam a localização sem campo, métodos de documento retornam formato explícito. Não há segundo store ou política. Todo novo caminho de captura usa o formato explícito. `ObjectLocation` admite `documentFormat` opcional com esses literais. Localização histórica sem esse campo significa exclusivamente JSON legado; não inserir o campo retroativamente no JSON armazenado. Novas localizações registram o formato explícito.
- S3 PUT usa `application/json` para `d01.json.v1` e `text/csv` para `d01.csv.v1`. GET/locate e recuperação após resposta perdida/412 comparam o MIME exato esperado, além de versão, tamanho e digest. O reader verifica coerência do formato entre a captura SQL e a localização retida. Cleanup continua usando a localização e fencing reais; não infere formato pelo nome da key.
- `EvidenceOpened.mediaType` passa a aceitar `application/json | text/csv`, derivado do formato confiável da captura, e `document` contém o texto original. A resposta HTTP externa continua sendo o envelope JSON da API; o campo mediaType não muda o Content-Type desse envelope. O leitor reautoriza depois do I/O, como hoje. Falta/corrupção/incoerência do original permanece fail-closed, sem reconstruir CSV a partir de claims.

A adição da coluna caracteriza os registros JSON existentes pelo formato já conhecido; não altera blobs, receipts, Frames, digests, source labels ou decisões históricas. Root deve provar essa compatibilidade em PostgreSQL/S3 reais antes de admitir a migração. Não trocar releaseDigest, generation ou vínculo de World existente para contornar o guard de release. Enquanto não houver transição de release admitida para dados existentes, o perfil de prova CSV é isolado e os perfis anteriores permanecem preservados.

## Superfícies e política

Web e CLI escolhem o formato **explicitamente** e enviam o arquivo original ao mesmo executor. CLI propõe `import --format json|csv` com default JSON preservando o envelope legado; `csv` acrescenta somente `input.format: "d01.csv.v1"`. `--file`/stdin, origem explícita, sessão privada e operationId continuam existentes. Não criar `import-csv` com outro executor.

Na web, o usuário escolhe JSON ou CSV para o lote de arquivos antes do envio; os campos repetidos do próprio CSV fornecem os metadados de fonte. O frontend não interpreta linhas, deduz moeda ou transforma CSV em JSON. MIME/extensão são auxílio do file picker, não seleção autoritativa do parser. Um lote escolhido CSV contendo JSON falha naquele documento; não alterna automaticamente formato. A importação de vários arquivos conserva a semântica sequencial atual, sem promessa nova de atomicidade do lote. A evidência CSV é mostrada como texto escapado, sem executar fórmulas ou oferecer abertura automática em planilha.

A classificação e retenção do perfil `d01-local-retained-v1` continuam as atuais. Congelar CSV amplia a representação admitida, não habilita apagamento, dados sensíveis, conectores, licença, legal hold, avaliação/live compartilhados ou upload para terceiro. A política continua verificada no servidor; adicionar `format` no cliente não habilita um formato ainda não publicado/admitido na composição.

## Allowlist proposta e sequência de integração

A implementação segue EX16–EX19 e as provas estão em [csv-local.md](../verification/csv-local.md). A tabela registra a divisão do handoff; arquivos reservados continuam com root.

| Camada / responsável a designar | Paths delimitados | Resultado necessário |
| --- | --- | --- |
| Contratos públicos | `packages/contracts/src/d01/operations.ts`, `values.ts` e testes correspondentes | União exata de input, formato compartilhado e MIME de EvidenceOpened; compatibilidade de envelope legado |
| Parser e normalizador | `packages/authority/src/values/csv.ts` e `document.ts` novos; `json.ts`, `canonical.ts`; `packages/authority/test/values/**` | Gramática limitada, uma validação de documento para import e digest, sem mudar canonicalização legada |
| Captura e admissão | `packages/authority/src/evidence/d01/{import,capture,open,cleanup}.ts`, `ports/d01/storage.ts`; `tests/integration/d01/evidence/**` | Formato vinculado à captura/localização e mesma admissão/retention/replay |
| Adapter S3 | `apps/server/src/adapters/object-storage/d01/s3.ts` e testes reais em `apps/server/test/adapters/object-storage/d01/**` | MIME correto, verificação fechada e recuperação reais nos dois formatos |
| Web | `apps/web/src/features/d01/{feature,requests,file,client,presentation}.ts*`; helpers/componentes novos somente se consumidos; testes de features/integration | Seletor explícito, raw text intacto, coordenada lógica/evidência CSV e jornadas reais |
| CLI | `apps/cli/src/d01/{command,input,input-stream}.ts` e testes CLI/integração | Flag explícita, raw stdin/file preservado, mesmo operationId e executor |
| Root reservado | `ops/migrations/**`, propostas SQL D01, schemas privados afetados, manifest de migração/release, composição/configuração/exports/package/lock e runner de aceitação | Migração aditiva real, guards e registro de comportamento efetivamente composto |

`cleanup.ts`, leitores raw, client, DTOs de claims, `evidence.ts` e portas adicionais só precisam mudar se o handoff congelado exigir um consumidor concreto; não preencher allowlist com alterações cosméticas. Não introduzir biblioteca CSV, novo módulo genérico, dependência ou wrapper de SQL sem revisão da necessidade e do comportamento exato. Se uma API interna indispensável ainda não estiver definida no handoff, registrar bloqueio antes de implementá-la.

Sequência proposta: (1) root congela dialeto, união de envelope, metadados físicos e ownership; (2) parser/contratos + storage/captura com suas provas em ramos delimitados; (3) root integra migração/composição real e verifica JSON legado; (4) web/CLI ligam o formato explícito; (5) outro autor executa os oráculos de aceitação. Nenhuma aceitação decorre apenas de arquivos criados ou build verde.

## Oráculos exigidos, sem resultados antecipados

A tabela abaixo define os oráculos exigidos. Os resultados executados e os limites de CSV-09/CSV-12 estão em [csv-local.md](../verification/csv-local.md); não inferir conclusão integral desta lista. Dados sintéticos alimentam parsers e infraestrutura reais; não há provider falso ou identidade privilegiada. Root deve preservar baseline, tratamento e artefatos com versão do código/perfil.

| ID | Camada e testemunha concreta |
| --- | --- |
| CSV-01 | Parser puro: exemplo acima vira dois ImportRecord exatos, incluindo Known 100.00/BRL e Unknown independente de tempo; cabeçalho não vira claim. |
| CSV-02 | Parser puro: vírgula citada, aspas duplicadas, campo multilinha LF/CRLF e terminador opcional preservam texto; aspas pendentes/soltas, tentativa de escapar aspas por backslash, CR isolado, separadores externos misturados, cabeçalho diferente e 13/15 campos são recusados. |
| CSV-03 | Parser puro: tabela de Known zero/escala/limites/negativo, Unknown com células obrigatoriamente vazias, moedas exatas e datas válidas/extremas; expoente, localidade, coerção de vazios, data impossível e intervalo vazio/invertido falham. |
| CSV-04 | Parser puro: source repetido exatamente aceito; alteração de qualquer metadado, versão desconhecida, duplicate recordExternalId, BOM inicial, UTF-8 inválido/NUL/não caractere/controle recusados. NFC e NFD válidos permanecem distintos. |
| CSV-05 | Limites: 200 registros aceitos e 201 recusados; documento autorizado de tamanho limítrofe construído com campos válidos, e byte excedente recusado; bytes UTF-8 multibyte contados corretamente. Verificar que a recusa precede reserva/S3/publicação, sem aumentar limites para passar o teste. |
| CSV-06 | Canonicalização/contrato: golden digests e requests JSON legados continuam idênticos; CSV validado por import e intentDigest aceita/recusa as mesmas formas. LF↔CRLF, aspas redundantes, espaço ou um byte alterado modificam o digest da intenção/byte identity sem reescrever o original. |
| CSV-07 | PostgreSQL+S3 reais: normal signup → World → import CSV → Inspect → OpenEvidence. Claims unverified com valores/datas/source/recordIndex corretos; objeto versionado, MIME text/csv, tamanho e SHA-256 correspondem aos bytes enviados; OpenEvidence recupera os mesmos bytes, não JSON reconstruído. |
| CSV-08 | Mesma instalação/conta/World: replay concorrente da mesma operação e intenção retorna receipt estável, uma publicação; operação igual com bytes diferentes conflita; nova operação com CSV idêntico não duplica claims; mesma source/revisão em JSON e CSV de significado igual conflita por bytes distintos. |
| CSV-09 | Duas contas/Worlds reais: outra conta não lê evidência/Frame/receipt; revogação antes do replay e antes da emissão após I/O nega sem conteúdo/metadados ocultos. Usar barreira real, não resposta fabricada. |
| CSV-10 | Storage real: objeto ausente, versão errada, bytes/tamanho/digest ou MIME incompatível impedem OpenEvidence/admissão. Recuperação real após upload sem acknowledgement/412 mantém formato/digest; captura expirada e cleanup não removem evidência pinada, JSON nem CSV. |
| CSV-11 | Transação real: CSV inválido não publica parcela válida; falha observada na transação conserva atomicidade de claims/evidence/pins/domains/operation/receipt/outbox. Reutilizar a prova de processo existente com entrada CSV sem alegar que isso cobre todos os crashes. |
| CSV-12 | Migração real: fixture com evidência JSON, Frame, receipt e objeto já existentes recebe a alteração aditiva; localização sem documentFormat continua JSON, todos os bytes/replays/cortes anteriores permanecem iguais; nova captura CSV usa formato explícito. Sem fabricar imagem/release ou rebind de dados. |
| CSV-13 | Browser+CLI reais: web envia CSV bruto com seletor; CLI repete exatamente o request/opID e observa mesmo receipt. CLI stdin/file preservam CRLF, aspas e newline final. Seleção JSON com CSV é recusada; não há fallback. Inspeção mostra fonte/registro lógico e texto escapado; logout, segundo principal e back não recuperam payload. |
| CSV-14 | Jornada mista: duas fontes autorizadas CSV/JSON com mesmo subject/predicate/unidade/intervalo e valores divergentes ficam visíveis sem substituir a origem; correção/unknown/undo continuam no mesmo executor, com Stale e cortes históricos preservados. Cópias não recebem confiança/suporte independente inventado. |

Antes de executar CSV-05, o autor deve provar que a fixture no limite de bytes ainda satisfaz limites por campo/registro; não usar arquivo estruturalmente inválido para reivindicar a fronteira aceita. Antes de CSV-12 em dados de aplicação, a transição de release deve estar admitida; uma fixture isolada não autoriza modificar o release de Worlds existentes. Compilação, testes puros, integração, browser, caos e admissão continuam evidências separadas (INV-20).
