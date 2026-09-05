# Contrato de montagem do workspace v5

A organização v5 preserva o produto v4 e seus 325 IDs de ticket. Esta emenda não autoriza uma segunda implementação do executor, da política, da identidade ou da interpretação.

## Representações

O registro `planning/files.json` identifica o caminho pretendido, os responsáveis, a spec, os tickets, a obrigatoriedade e a representação.

`comment-only-source`: o arquivo reservado contém só comentários, com marcador `@zoen-plan`. Não possui exports, imports, testes falsos ou retornos temporários. Não entra na lista explícita de build.

`existing-with-sidecar`: código/config existente permanece intacto; o plano fica em `arquivo.ext.plan.md`. Código herdado não implica cobertura completa nem aceite.

`sidecar-only`: JSON, SQL, arquivos de admissão, lockfiles, infraestrutura e configuração ainda inexistentes são planejados ao lado do destino. O artefato real deliberadamente não existe. Assim o migrador não registra migração vazia e ferramentas não consomem um schema permissivo por acidente.

`markdown-plan`: runbook planejado, com condições de operação ainda não qualificadas.

Caminho condicional é permissão para criar suporte quando necessário, não obrigação de criar abstração vazia.

## Código antes do novo esqueleto

Os nomes de seis caminhos planejados foram vinculados aos módulos já existentes. Veja [emenda 066](amendments/066-workspace-assembly.md). Ao implementar um segmento, amplie o mecanismo existente; não copie o algoritmo do módulo para cada arquivo.

Cada algoritmo identifica a sequência compartilhada. O pseudocódigo no arquivo restringe o ticket à sua etapa. Uma função pública continua sendo aquela da spec; rótulos `PROCEDURE ZN_...` são rótulos de planejamento, não novas APIs.

## Promover um plano para implementação

1. Obtenha o ticket elegível, respeite o allowlist e reserve os locks. Consulte código e dependências existentes.
2. Altere o registro desse arquivo para `existing-with-sidecar`, com status `implementation-in-progress` e `plan_path` igual a `target + ".plan.md"`. Registre o ticket no diff; isso não aceita o trabalho.
3. Gere o sidecar com `python tooling/generate-plans.py`. O conteúdo do target não será reescrito nessa representação. Implemente o código real no target; remova o marcador `@zoen-plan` somente ali.
4. Atualize explicitamente a lista de fontes e tsconfig para os fontes reais, e a composição exigida. Para testes e migrations, atualize o coletor/ordem real sob o ticket apropriado. Nunca inclua planos por glob para fingir cobertura.
5. Execute os checks exatos no ambiente admitido. Planos, comentários e arquivos de teste sem asserts não contam. Revise o diff e anexe evidência independente antes do aceite.

O gerador recusa sobrescrever um target ainda marcado no registro como plano quando ele já contém código. Não use uma opção de força para apagar implementação. Campos de inventário precisam refletir mudanças reais e revisadas.

## Artefatos que só uma execução produz

Nunca renomear `.plan.md` para `.json/.sql/.yaml` como implementação automática. Locks vêm do package manager; tipos/clientes gerados vêm dos schemas; SQL vem de migração revisada; hashes/assinaturas vêm dos bytes reais; relatórios/certificados vêm de execuções e aprovações reais; secrets não entram no Git.

## Migrations

Há apenas as migrations SQL candidatas herdadas no caminho executável. Os caminhos `zn-...sql.plan.md` reservam escopo lógico. Ao realmente introduzir DDL, atribua o próximo número monotônico aceito pelo migrador, atualize o path binding do ticket sob revisão e prove upgrade/roles/falha. Não executar arquivos de plano nem manter SQL que o migrador ignora silenciosamente.

## Testes e estados

Sem substitutos de serviços. Registros sintéticos são entradas de teste; funções puras não precisam de provider fake. O recurso de child scope desconectado em SPEC-044 é produto futuro explícito, não fallback para serviços ausentes.

Esta entrega preserva todos os checks de produto em `not-executed`. Relatórios de controles locais, compilação do núcleo, leis e mutações selecionadas têm escopos separados. Os validadores locais não autenticam a honestidade de uma pessoa que falsifica um log; CI confiável e revisão independente continuam necessárias.
