# Viabilidade local S3 para o candidato de erasure

Resultado de 2026-09-05: **suporte observado nos três grupos exercitados** no
RustFS local: versões/paginação, delete markers/versão literal `null`, e
multipart/listagem/abort. Nenhuma operação exercitada retornou Unsupported ou
NotImplemented. Isso é experimento de provider, não implementação, admissão de
perfil, prova de grants do runtime ou conclusão de erasure/restore.

## Ambiente e escopo realmente usados

| Item | Observação |
| --- | --- |
| Container já existente | `zoen-rebuild-object-storage-1`, sem reinício ou mudança de configuração |
| Imagem e digest inspecionados | `rustfs/rustfs:1.0.0-rc.5@sha256:c36b3efea3d1e503f1a2581abd0e7611e0e5820dd30e1850a52384b3fc52bda4` |
| Binário, via `docker exec … rustfs --version` | `rustfs 1.0.0-rc.5`; commit `40a2470feb567201165a5b809b7598bb4b1f68f5`; build `2026-09-01 23:05:52 +00:00`; release |
| Plataforma | Docker informa `linux/arm64`; o texto interno do binário informa `build os: linux-x86_64`. Ambos são registrados como observados, sem resolver essa divergência por inferência. |
| Cliente principal | Node `v24.18.1`, Darwin/arm64, SDK instalado `@aws-sdk/client-s3` **3.1127.0** |
| Transporte | Endpoint local de `.env.infra`, path-style, região `us-east-1`, `maxAttempts:1`, timeout de conexão 3 s/requisição 10 s |
| Credencial | Bootstrap de infraestrutura que o compose fornece como credencial RustFS. Valores não impressos. Não é prova de least privilege do runtime. |
| Dados | Strings sintéticas e três partes de 1 MiB; nenhum World, perfil, objeto ou bucket preexistente foi usado |

A primeira execução usou o `node` que o shell resolveu como **v22.22.3**. Passou
os três grupos e limpou seu próprio bucket. A prova foi repetida com o binário
Node24 explícito para corresponder à versão major exigida pelo repositório;
nenhum resultado anterior foi descartado nem o esperado foi alterado.

| Execução | Bucket exclusivo criado | Período UTC e término |
| --- | --- | --- |
| Node22 inicial | `zoen-erasure-probe-a48d8c30-016b-40f0-8b17-d2ceb371f1df` | 21:23:57.092–21:23:57.387; três grupos PASS, exit 0 |
| Node24 principal | `zoen-erasure-probe-b734dd02-f246-4efc-a021-02f04a4265c2` | 21:24:38.091–21:24:38.411; três grupos PASS, exit 0 |

Os tempos são carimbos do experimento, **não benchmark**. Em ambas as execuções,
limpeza final observou lista de uploads vazia, removeu a versão restante de seu
caso `null`, observou inventário de versões vazio, recebeu DELETE Bucket 204 e
HEAD Bucket 404. A exclusão só foi habilitada após o próprio CreateBucket ter
sido confirmado para o UUID gerado. Nenhum ListBuckets foi usado.

## Resultados observados

| Grupo / APIs reais | Dados e resultado principal Node24 |
| --- | --- |
| `PutObject`, `PutBucketVersioning`, `GetBucketVersioning`, `ListObjectVersions`, `GetObject`, `DeleteObject` | PUT antes de versioning não devolveu VersionId; após habilitar, GET da configuração confirmou Enabled. Novo PUT na mesma chave gerou versão não-null. Duas páginas de tamanho 1 listaram exatamente a versão nova e a string literal `"null"`. GET explícito de `"null"` recuperou o corpo antigo. DELETE com `VersionId:"null"` retornou 204; GET dessa versão retornou 404 `NoSuchKey`; GET corrente continuou 200 com o corpo novo. Listagem posterior continha só a versão nova. |
| `ListObjectVersions` com ambos os cursores | Cinco chaves, incluindo uma aninhada; quatro versões por chave e um delete marker por chave: **25 entradas em 13 páginas** com `Prefix:"pages/"`, `MaxKeys:2`, sem delimiter. Conjunto retornado igualou exatamente o conjunto de IDs produzidos pelos PUT/DELETE, sem duplicatas ou omissões. Cada página truncada repassou NextKeyMarker e NextVersionIdMarker integralmente. |
| DELETE sem versão e delete marker explícito | Cada DELETE sem VersionId retornou DeleteMarker true com ID próprio. GET corrente retornou 404, mas GET de uma versão histórica continuou 200 com corpo exato. Remover o marker exato de `pages/a` tornou o corpo mais recente visível novamente: marker não equivale a remover dados. |
| DELETE de todas as versões/markers conhecidos | Remoção explícita das 25 entradas do manifesto; DELETEs retornaram 204. GET explícito de **cada um dos 25 IDs** após remoção retornou 404 `NoSuchKey`. Nova varredura do prefixo retornou zero versões/markers, não truncada. |
| `CreateMultipartUpload`, `UploadPart`, `ListParts` | Três uploads, dois na mesma chave `multipart/a`, um em `multipart/b`. Uma parte de 1 MiB por upload retornou 200; ListParts mostrou exatamente parte 1/tamanho 1048576 para cada ID. Não houve CompleteMultipartUpload. |
| `ListMultipartUploads` com ambos os cursores | `MaxUploads:1`: três páginas, com conjunto exato dos três IDs conhecidos. Nas páginas seguintes foram repassados NextKeyMarker e NextUploadIdMarker. A presença de dois uploads na mesma chave exercitou o segundo cursor. |
| `AbortMultipartUpload` e consulta posterior | Cada abort retornou 204. ListParts do mesmo ID retornou 404 `NoSuchUpload`; GET da chave não completada retornou 404; listagem final de uploads vazia e não truncada. |

### Particularidade observada dos cursores

Em **8 das 13 páginas** do manifesto principal, NextKeyMarker tinha um sufixo
`[rustfs_cache:v2,…]`, em vez de ser apenas a chave de objeto. O cliente preservou
o valor inteiro como token opaco; não reconstruiu, truncou ou normalizou esse
cursor. A paginação funcionou também quando o servidor passou a devolver chave
simples nas páginas seguintes. Exemplo real da primeira página Node24:

```json
{
  "request": {
    "Prefix": "pages/",
    "MaxKeys": 2
  },
  "nextKey": "pages/a[rustfs_cache:v2,id:722e042b-bbd5-40af-ae73-ae2a892f5bff,src:walker,gen:live]",
  "nextVersion": "8cae56c0-f40f-4ea6-8298-918f67420e0b",
  "truncated": true
}
```

Esse comportamento não prova portabilidade ou estabilidade do token através de
restart, expiração de cache ou mutação concorrente. Esses cenários não foram
executados. Também não se presume ordem intercalada entre os arrays separados
Versions e DeleteMarkers; o oráculo compara o conjunto exato de identidades.

## Fontes e interpretação

O SDK instalado expõe os comandos usados e seus campos em
`node_modules/@aws-sdk/client-s3/dist-types/commands/` e `models/models_0.d.ts`.
A execução acima, e não a existência desses tipos, demonstra o suporte observado.

A documentação S3 especifica as duas marcas de continuação para versões e
separa Versions de DeleteMarkers. Ela também explica que delimiter agrupa chaves,
por isso o manifesto do experimento o omite.
[ListObjectVersions — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectVersions.html).
DELETE sem versão pode criar marker, enquanto VersionId identifica a versão a
remover; os resultados locais acima verificam precisamente essa diferença.
[DeleteObject — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html).
GET com versionId seleciona uma versão específica e tem autorização própria no
modelo AWS; usar bootstrap aqui não valida essa separação no runtime RustFS.
[GetObject — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html).

CreateMultipartUpload devolve o UploadId que vincula as partes e o abort.
[CreateMultipartUpload — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html),
[UploadPart — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html),
[ListParts — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html).
ListMultipartUploads exige conservar ambos os cursores para continuar dentro
da mesma chave.
[ListMultipartUploads — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListMultipartUploads.html).
Abort durante envio de parte em voo pode exigir novas tentativas/reconciliação;
neste experimento todas as partes já tinham resposta conhecida antes do abort.
[AbortMultipartUpload — AWS](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html).

A matriz oficial RustFS declara cobertura parcial e deixa edge cases de listagem
multipart/consulta de partes fora de seu gate padrão. Sua referência publicada
é outro commit, de agosto; não foi tratada como certificado deste rc.5.
[Matriz de compatibilidade RustFS](https://docs.rustfs.com/en/reference/s3-compatibility).
Uma URL inicialmente tentada para versioning não estava disponível; não foi usada
como suporte factual. Não se inferiu o suporte local de uma release mais recente.

## Limites e consequências para o candidato

- Somente operação quiescente, pequena, em nó local com bootstrap. Sem concorrência
  de PUT, perda de processo, restart de RustFS, falha de disco, partição ou resultado
  externo ambíguo. DELETE+GET404 não demonstra fencing de um PUT ainda em voo.
- Sem Object Lock, legal hold, retention, MFA, bypass, política IAM ou credencial
  restrita configurados/modificados. Não houve AccessDenied nesta amostra; isso
  não prova isolamento, nem suporte seguro a holds, nem permissões do runtime.
- Sem batch DeleteObjects, replicação, lifecycle, versioning suspenso, multipart
  completo, copy, criptografia, backups, rollback ou destruição física da mídia.
  Não se conclui ausência de cópias fora das APIs inventariadas.
- A versão literal `"null"` existe e precisa ser representada distintamente de
  ausência de VersionId. A porta atual que normaliza esses casos não serve como
  porta exaustiva de purge; nenhum código dessa porta foi alterado aqui.
- Compatibilidade pontual ajuda a desenhar um futuro ticket; não satisfaz os
  gates de erasure, controlador externo, restore ou perfil novo. Nenhum deles
  foi ativado, e estes três grupos não contam como checks de produto entregues.

## Reprodução e evidência

O probe manual fica em `.local/erasure-s3-feasibility/probe.mjs`, ignorado pelo Git,
na worktree do autor `/Users/enzotironi/zoen-ex01-proof`. Sua fonte exata está no
apêndice abaixo para reprodução sem depender desse arquivo não rastreado.
Extrair apenas o bloco marcado para `.local`; não registrá-lo como runtime,
CLI default ou teste de produto. Cada execução gera novo bucket e novo JSONL
modo 0600. O código não recebe nome de bucket externo e só limpa o que criou.

```sh
python3 - <<'PY'
from pathlib import Path
report = Path('docs/verification/erasure-s3-feasibility.md').read_text()
source = report.rsplit('<!-- probe-source -->', 1)[1].split('```javascript\n', 1)[1].split('\n```', 1)[0]
target = Path('.local/erasure-s3-feasibility/probe.mjs')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(source + '\n')
PY
/Users/enzotironi/.local/share/mise/installs/node/24.18.1/bin/node --env-file=.env.infra .local/erasure-s3-feasibility/probe.mjs
```

O caminho do binário acima foi o realmente usado; em outra máquina selecionar
Node24 disponível. Não imprimir `.env.infra` nem payload de erro completo do SDK.
O probe registra apenas nome/status de erro, referências sintéticas e resultados.

SHA-256 da fonte final executada:
`b91003a28a2f509e62941fe90033af16911d53748025791476d174b368203061`.
SHA-256 de `.local/erasure-s3-feasibility/node24-console.jsonl`:
`dfb441f62362c76fe63e822e7cd380c28b173604dcfeca9943cb2774501c1497`.
Os hashes identificam arquivos observados; não são certificados de provider.
A execução Node22 permanece em `result.jsonl`; a Node24 também gerou JSONL com
nome próprio. Resumo Node24: três PASS, cleanup-complete e exit 0. Todos os
status e inventários descritos neste relatório vieram dessas respostas reais.

## Apêndice — probe manual executado

<!-- probe-source -->
```javascript
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';
import * as S3 from '@aws-sdk/client-s3';

const bucket = `zoen-erasure-probe-${randomUUID()}`;
const logFile = new URL(`./result-${process.version}-${randomUUID()}.jsonl`, import.meta.url);
const emit = (event, data = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...data });
  appendFileSync(logFile, `${line}\n`, { mode: 0o600 });
  console.log(line);
};
writeFileSync(logFile, '', { mode: 0o600, flag: 'wx' });
const client = new S3.S3Client({
  endpoint: process.env.ZOEN_TEST_S3_ENDPOINT,
  credentials: { accessKeyId: process.env.ZOEN_TEST_S3_ACCESS_KEY, secretAccessKey: process.env.ZOEN_TEST_S3_SECRET_KEY },
  region: 'us-east-1', forcePathStyle: true, maxAttempts: 1,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
});
const send = (Command, input) => client.send(new Command({ Bucket: bucket, ...input }));
const errorInfo = (error) => ({ name: error.name, status: error.$metadata?.httpStatusCode });
const cases = [];
async function check(name, run) {
  try { await run(); cases.push({ name, result: 'PASS' }); emit('case', { name, result: 'PASS' }); }
  catch (error) { cases.push({ name, result: 'FAIL', ...errorInfo(error), message: error instanceof assert.AssertionError ? error.message : undefined }); emit('case', cases.at(-1)); }
}
async function get(Key, VersionId) {
  try {
    const response = await send(S3.GetObjectCommand, { Key, ...(VersionId === undefined ? {} : { VersionId }) });
    const body = await response.Body.transformToString();
    return { status: response.$metadata.httpStatusCode, version: response.VersionId, body };
  } catch (error) { return errorInfo(error); }
}
async function allVersions(Prefix = '', MaxKeys = 2, phase = 'versions') {
  let KeyMarker; let VersionIdMarker;
  const entries = []; const visited = new Set(); let page = 0;
  do {
    const response = await send(S3.ListObjectVersionsCommand, { Prefix, MaxKeys, ...(KeyMarker === undefined ? {} : { KeyMarker }), ...(VersionIdMarker === undefined ? {} : { VersionIdMarker }) });
    const versions = (response.Versions ?? []).map(v => ({ key: v.Key, version: v.VersionId, marker: false, latest: v.IsLatest }));
    const markers = (response.DeleteMarkers ?? []).map(v => ({ key: v.Key, version: v.VersionId, marker: true, latest: v.IsLatest }));
    emit('version-page', { phase, page: ++page, request: { Prefix, MaxKeys, KeyMarker, VersionIdMarker }, status: response.$metadata.httpStatusCode, truncated: response.IsTruncated, nextKey: response.NextKeyMarker, nextVersion: response.NextVersionIdMarker, entries: [...versions, ...markers] });
    entries.push(...versions, ...markers);
    if (!response.IsTruncated) return entries;
    assert.ok(response.NextKeyMarker !== undefined, 'truncated page must supply a key cursor');
    const cursor = JSON.stringify([response.NextKeyMarker, response.NextVersionIdMarker]);
    assert.ok(!visited.has(cursor), 'pagination cursor must advance');
    visited.add(cursor); KeyMarker = response.NextKeyMarker; VersionIdMarker = response.NextVersionIdMarker;
    assert.ok(page < 100, 'bounded version pagination');
  } while (true);
}
async function allUploads(phase = 'uploads', MaxUploads = 1) {
  let KeyMarker; let UploadIdMarker; const uploads = []; const visited = new Set(); let page = 0;
  do {
    const response = await send(S3.ListMultipartUploadsCommand, { MaxUploads, ...(KeyMarker === undefined ? {} : { KeyMarker }), ...(UploadIdMarker === undefined ? {} : { UploadIdMarker }) });
    const rows = (response.Uploads ?? []).map(u => ({ Key: u.Key, UploadId: u.UploadId }));
    emit('multipart-page', { phase, page: ++page, request: { MaxUploads, KeyMarker, UploadIdMarker }, status: response.$metadata.httpStatusCode, truncated: response.IsTruncated, nextKey: response.NextKeyMarker, nextUpload: response.NextUploadIdMarker, uploads: rows });
    uploads.push(...rows);
    if (!response.IsTruncated) return uploads;
    const cursor = JSON.stringify([response.NextKeyMarker, response.NextUploadIdMarker]);
    assert.ok(response.NextKeyMarker !== undefined && !visited.has(cursor), 'multipart cursor must advance');
    visited.add(cursor); KeyMarker = response.NextKeyMarker; UploadIdMarker = response.NextUploadIdMarker;
    assert.ok(page < 100, 'bounded multipart pagination');
  } while (true);
}
let created = false;
const knownUploads = [];
try {
  const creation = await send(S3.CreateBucketCommand, {}); created = true;
  emit('start', { bucket, node: process.version, createStatus: creation.$metadata.httpStatusCode, region: 'us-east-1', maxAttempts: 1 });
  await check('literal-null-version', async () => {
    const Key = 'null-case/item';
    const first = await send(S3.PutObjectCommand, { Key, Body: 'synthetic-null-before-versioning' });
    emit('put-before-versioning', { version: first.VersionId, status: first.$metadata.httpStatusCode });
    await send(S3.PutBucketVersioningCommand, { VersioningConfiguration: { Status: 'Enabled' } });
    const state = await send(S3.GetBucketVersioningCommand, {});
    assert.equal(state.Status, 'Enabled');
    const second = await send(S3.PutObjectCommand, { Key, Body: 'synthetic-current-after-versioning' });
    assert.ok(second.VersionId && second.VersionId !== 'null');
    const versions = await allVersions('null-case/', 1, 'null-before-delete');
    assert.equal(versions.length, 2); assert.ok(versions.some(v => v.version === 'null'));
    assert.equal((await get(Key, 'null')).body, 'synthetic-null-before-versioning');
    const removed = await send(S3.DeleteObjectCommand, { Key, VersionId: 'null' });
    const absent = await get(Key, 'null'); const current = await get(Key);
    emit('null-explicit-delete', { status: removed.$metadata.httpStatusCode, absent, current });
    assert.equal(absent.status, 404); assert.equal(current.body, 'synthetic-current-after-versioning');
    assert.deepEqual((await allVersions('null-case/', 1, 'null-after-delete')).map(v => v.version), [second.VersionId]);
  });
  await check('version-pagination-delete-markers-explicit-removal', async () => {
    // Ensure this case is independent of any prior assertion after the versioning request.
    await send(S3.PutBucketVersioningCommand, { VersioningConfiguration: { Status: 'Enabled' } });
    const expected = []; const contents = new Map();
    for (const Key of ['pages/a', 'pages/b', 'pages/c', 'pages/d', 'pages/nested/e']) {
      for (let revision = 0; revision < 4; revision++) {
        const Body = `synthetic:${Key}:${revision}`;
        const written = await send(S3.PutObjectCommand, { Key, Body });
        assert.ok(written.VersionId && written.VersionId !== 'null');
        expected.push({ key: Key, version: written.VersionId, marker: false });
        contents.set(written.VersionId, Body);
      }
      const marker = await send(S3.DeleteObjectCommand, { Key });
      assert.equal(marker.DeleteMarker, true); assert.ok(marker.VersionId);
      expected.push({ key: Key, version: marker.VersionId, marker: true });
      const current = await get(Key);
      assert.equal(current.status, 404);
      const older = expected.find(v => v.key === Key && !v.marker);
      assert.equal((await get(Key, older.version)).body, contents.get(older.version));
      emit('marker-hides-current-not-history', { key: Key, marker: marker.VersionId, current, explicitOlderStatus: 200 });
    }
    const listed = await allVersions('pages/', 2, 'manifest');
    const identity = row => JSON.stringify([row.key, row.version, row.marker]);
    assert.equal(new Set(listed.map(identity)).size, 25);
    assert.deepEqual(listed.map(identity).sort(), expected.map(identity).sort());
    // Deleting one exact marker exposes the last data version, proving marker removal is not data removal.
    const marker = expected.find(v => v.key === 'pages/a' && v.marker);
    await send(S3.DeleteObjectCommand, { Key: marker.key, VersionId: marker.version });
    const revealed = await get(marker.key);
    assert.equal(revealed.body, 'synthetic:pages/a:3');
    emit('marker-removal-reveals-data', { key: marker.key, status: revealed.status });
    for (const entry of expected) {
      if (entry === marker) continue;
      const removed = await send(S3.DeleteObjectCommand, { Key: entry.key, VersionId: entry.version });
      assert.equal(removed.$metadata.httpStatusCode, 204);
    }
    for (const entry of expected) {
      const absent = await get(entry.key, entry.version);
      emit('version-after-removal', { key: entry.key, version: entry.version, marker: entry.marker, ...absent });
      assert.equal(absent.status, 404);
    }
    assert.deepEqual(await allVersions('pages/', 2, 'post-purge'), []);
  });
  await check('multipart-pagination-parts-abort', async () => {
    for (const Key of ['multipart/a', 'multipart/a', 'multipart/b']) {
      const initiated = await send(S3.CreateMultipartUploadCommand, { Key });
      assert.ok(initiated.UploadId);
      const upload = { Key, UploadId: initiated.UploadId }; knownUploads.push(upload);
      const part = await send(S3.UploadPartCommand, { ...upload, PartNumber: 1, Body: Buffer.alloc(1024 * 1024, 65) });
      assert.equal(part.$metadata.httpStatusCode, 200);
      const parts = await send(S3.ListPartsCommand, upload);
      emit('parts-before-abort', { ...upload, status: parts.$metadata.httpStatusCode, parts: parts.Parts?.map(p => ({ number: p.PartNumber, size: p.Size })) });
      assert.deepEqual(parts.Parts?.map(p => [p.PartNumber, p.Size]), [[1, 1024 * 1024]]);
    }
    const listed = await allUploads();
    const identity = u => JSON.stringify([u.Key, u.UploadId]);
    assert.deepEqual(listed.map(identity).sort(), knownUploads.map(identity).sort());
    for (const upload of knownUploads) {
      const aborted = await send(S3.AbortMultipartUploadCommand, upload);
      assert.equal(aborted.$metadata.httpStatusCode, 204);
      let partsAfter;
      try { const parts = await send(S3.ListPartsCommand, upload); partsAfter = {status: parts.$metadata.httpStatusCode, count: parts.Parts?.length}; }
      catch (error) { partsAfter = errorInfo(error); }
      emit('parts-after-abort', { ...upload, abortStatus: aborted.$metadata.httpStatusCode, partsAfter });
      assert.deepEqual(partsAfter, {name: 'NoSuchUpload', status: 404});
      assert.equal((await get(upload.Key)).status, 404);
    }
    assert.deepEqual(await allUploads('post-abort'), []);
  });
} catch (error) { emit('fatal', errorInfo(error)); process.exitCode = 1; }
finally {
  if (created) {
    try {
      // UUID bucket was created by this process. Never enumerate or delete another bucket.
      for (const upload of await allUploads('cleanup', 1000)) await send(S3.AbortMultipartUploadCommand, upload);
      const remaining = await allVersions('', 1000, 'cleanup');
      for (const entry of remaining) {
        assert.ok(entry.key !== undefined && entry.version !== undefined);
        await send(S3.DeleteObjectCommand, { Key: entry.key, VersionId: entry.version });
      }
      assert.deepEqual(await allVersions('', 1000, 'cleanup-verify'), []);
      const deleted = await send(S3.DeleteBucketCommand, {});
      let absent;
      try { const result = await send(S3.HeadBucketCommand, {}); absent = {status: result.$metadata.httpStatusCode}; }
      catch (error) { absent = errorInfo(error); }
      assert.equal(absent.status, 404);
      emit('cleanup-complete', { bucket, removedVersions: remaining.length, deleteStatus: deleted.$metadata.httpStatusCode, absent });
    } catch (error) { emit('cleanup-failed', { bucket, ...errorInfo(error) }); process.exitCode = 1; }
  }
  emit('summary', { bucket, cases });
  if (cases.some(c => c.result !== 'PASS')) process.exitCode = 1;
  client.destroy();
}
```
