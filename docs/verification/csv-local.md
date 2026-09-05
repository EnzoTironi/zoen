# Incremento CSV — prova local

Estado em 2026-09-05: CSV explícito executa na composição local de JSON/correções, sob o mesmo perfil retido não sensível. O build de `048d937` foi provisionado como `csvv2`, com manifesto SHA-256 `b98edd29ea2d12ee0fd2b3001a82885733c0929766f75e001a6780327bec94de`. Ele conserva os artefatos e bases dos perfis anteriores; nenhuma release de um World antigo foi rebatizada.

## Evidência observada

- Parser/contratos: gramática limitada, source repetido, valores/datas explícitos, Unicode, limite de 200 registros e fixture válida de 262.144 bytes; golden digests JSON preservados. Os testes puros combinados passaram; o conjunto atual em `921d68c` tem 189 testes em 24 arquivos, incluindo um schema novo de compartilhamento que não é aceitação desse recurso.
- Storage: 24 testes contra S3 real (14 anteriores e 10 de CSV), com revisão independente. MIME, bytes, digest, versão e recuperação de upload são conferidos; formatos incoerentes falham fechados.
- Executor/SQL/S3: signup normal, captura CSV, Inspect/OpenEvidence, concorrência, deduplicação, conflito por alteração de intenção e isolamento de outra identidade. O sweep remove órfãos CSV/JSON e preserva CSV admitido e pinado. O conjunto combinado de integração em `55917d9` passou em 104 testes/54 arquivos; testemunhas adicionais de processo e revisão foram executadas depois em seus commits e seguem para a CI combinada.
- Identidade de representação: `2f9fff6` compara JSON manual e CSVs equivalentes com CRLF/LF externo, aspas redundantes e label NFD/multilinha. Bytes diferentes conflitam mesmo quando o significado é igual; seletor incorreto/ausente falha antes de replay; receipt, Frame retido e evidência permanecem iguais.
- Processo: `fe86850` executa SIGKILL real com CSV. Antes do COMMIT não permanece publicação semântica; depois do commit e antes do acknowledgement, reinício e replay devolvem um resultado único. Isso não prova crash do PostgreSQL/S3 ou transação distribuída.
- Navegador/CLI: três cenários CSV passaram no profile `csvv2` em 36,7 s. A execução reunida local passou nos **sete cenários**, em aproximadamente 1,5 minuto: JSON anterior, CSV, fontes mistas, correção/unknown/undo, Stale, histórico, logout/segunda identidade e retry. CLI por stdin e arquivo conserva CRLF, aspas e newline final, reproduz o mesmo receipt da web; JSON sem `--format` conserva o envelope legado.
- Componentes: sete cenários Chromium passaram. Build, TS7, lint e formato passaram no escopo integrado antes da publicação da CI. As camadas têm significados distintos.

A CLI `55917d9` foi revisada pelo worker 2: ajuda real com escolhas/exemplos, formato inválido termina com exit 2/erro JSON antes de consumir um stdin mantido aberto, sem achado no recorte. O worker 3 revisou parser/core/representação e migração; root reviu os diffs web e os oráculos. A imagem nova ainda precisa da CI após este checkpoint; a imagem JSON anterior não a comprova.

## Falhas e limites preservados

O navegador reproduziu uma falha de uso: após `InvalidInput`, a view indisponível ocultava a seleção de arquivo. O teste exigindo o input presente falhou contra o profile CSV anterior. `048d937` apresenta a view vazia em `InvalidInput`/`QuotaExceeded`, preserva a mensagem, limpa conteúdo privado e mantém seleção disponível. Erros de infraestrutura conservam retry da mesma identidade; negação continua fechada. O mesmo oráculo passou no profile novo, com arquivo CSV aceito depois da recusa sem reabrir World.

Dois problemas anteriores do harness foram distinguidos dessa falha: seleção em um controle ausente e request direto sem o Origin obrigatório. Os testes atuais usam o fluxo real recuperável e o Origin correto; nenhuma expectativa de conteúdo, receipt, Stale ou privacidade foi relaxada. Capturas de falha ficam nos diretórios exclusivos de cada execução, e logs locais conservam os resultados.

A migração 004 foi comprovada em SQL/S3 reais por `cfe8003`: nove tabelas de histórico e metadados 001–003 preservados, default JSON, CHECK/NOT NULL, nova captura CSV e bytes/versionamento anteriores intactos. **CSV-12 permanece parcial**: não há upgrade admitido de uma instalação existente nem prova integral de Frames/sessões durante esse upgrade. Os profiles são separados.

CSV-09 cobre a outra identidade e replay revogado, somando-se à rechecagem após S3 já exercida no executor. A exclusão da janela entre o último SELECT e emissão HTTP ainda depende da cerca de compartilhamento EX22/EX23; não se chama esse recheck de prova da cerca. CSV não conclui todo D01, D02, as 22 entregas, apagamento, restore, produção cloud ou providers externos.

## Executar

Em uma instalação nova deste build, defina `ZOEN_TEST_CSV_WEB_URL` com sua origem ao rodar `pnpm test:acceptance`. Essa variável é obrigatória para não executar a prova CSV silenciosamente contra um artefato JSON anterior. `pnpm test:container` injeta a URL da imagem que ele acabou de construir, provisiona seu próprio profile e executa os mesmos sete cenários com a CLI compilada do host.
