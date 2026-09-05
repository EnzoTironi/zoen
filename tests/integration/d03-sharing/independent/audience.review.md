# SH-02/03/04 — audiência e guard de replay

Revisão independente do core `deb4ff9` e directory real `fd4c88d`, sobre `92c26a7`. O arquivo adjacente usa contas criadas pelo Better Auth instalado, `Presence.verify` real, PostgreSQL com roles reais e S3 real. Os contextos são derivados das sessões verificadas. A migração 005 real é aplicada à fixture SQL isolada antes dos casos; a atomicidade de seu runner pertence à prova de migração separada.

## Achado reproduzido: replay contornava a instalação

Em 2026-09-05 às 16:39, após um grant válido, o mesmo request/opID retornou `WorldReadAccessGranted` com `AuthorityInstallation` diferente em cada uma das quatro dimensões: cellId, cellEpoch, generationId e releaseDigest. O controle pelo replay de `importEvidence` retornou `Stale` nos quatro casos. Nenhum World foi alterado ou associado a outra release. As instalações alternativas são entradas de contraprova ao componente, não imagens ou releases admitidas.

A causa estava no retorno antecipado de `readMutationReplay`: conferia autorização atual, mas não a igualdade de instalação que `commitMutation` verificava antes do replay. O contrato de compartilhamento preserva o executor/commit e seus guards; não autoriza que um receipt antigo atravesse outra instalação. O oráculo falhante foi entregue em `c016e0a` antes de qualquer correção, mantendo expectativa `Stale` para os dois caminhos.

Outro autor corrigiu o produto em `da739c3`, extraindo `authorizeMutation` da checagem anterior e usando-a no início/fim do replay antecipado e no commit. Essa correção foi aplicada à worktree isolada para verificação; não foi escrita pelo autor desta contraprova. O teste original passou sem alteração de expectativas após a correção.

## Audiência observada

Um owner importa duas evidências reais para o mesmo sujeito e concede viewer pela operação core real, consultando o directory Better Auth. O viewer lê claims/evidência existentes, gera seu próprio Frame e relê esse Frame. O owner cria uma Question e confirma uma correção privada. Antes, durante e depois dessas mudanças, todos os campos funcionais do Frame do viewer permanecem iguais; somente os novos FrameRefs são removidos da comparação. A correção aparece no Frame do owner e não no do viewer. O conteúdo aberto permanece idêntico.

O viewer não acessa o Frame histórico do owner; o owner também não acessa o Frame do viewer. Um terceiro sem grant não acessa evidência/Frame. Questions reais do owner e referências aleatórias são igualmente negadas ao viewer. Os handlers de ImportEvidence, ProposeCorrection, AnswerQuestion, UndoCorrection, GrantWorldReadAccess e RevokeWorldReadAccess negam o viewer. InspectWorldAccess permite sua própria membership; referências ao owner, a outra conta real e a UUID ausente são igualmente negadas. Uma terceira evidência importada depois do grant passa a ser visível, enquanto o Frame anterior permanece congelado.

Esses são handlers core reais, não uma jornada HTTP do executor de sharing nem uma prova da cerca. Não foram comparados headers/status de transporte, nem executadas corridas de revogação/último byte; SH-07/08 continuam separados. Não foram fabricadas respostas de serviço, Questions, correções, receipts ou Frames.

## Validação e limites

Após `da739c3`, os dois casos do arquivo de audiência e os dois guards EX05 passaram em execução sequencial; TypeScript, oxlint, oxfmt e `git diff --check` passaram. O acréscimo de audiência foi entregue em `4fec885`.

Uma execução adicional incluiu indevidamente `release.review.integration.test.ts`, cujo requisito é um build/manifest instalado coerente. Ela falhou no carregamento inicial com `ReleaseMismatch` desta worktree sem rebuild, antes do passo que altera bytes para a contraprova. Nenhum manifesto, release ou build foi reconstruído para contornar essa falha. Essa execução não é evidência de regressão do fix nem validação de release; a composição/build e sua prova permanecem com o integrador.

O material aguarda revisão do integrador. A reprodução e sua correção não autorizam ativar compartilhamento sem composição e cerca verificadas.
