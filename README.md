# Zoen Workspace v5

**Repositório organizado para implementar o produto v4 — não uma nova arquitetura nem um produto concluído.**

Este workspace preserva o código inicial, materializa a árvore planejada e liga cada responsabilidade à spec, ao ticket, ao algoritmo e ao teste exigido. O escopo continua sendo 157 capacidades, 56 specs e 325 tickets, de S0 a S11.

## Comece aqui

Leia [START-HERE.md](START-HERE.md). Para trabalhar, entregue ao modelo **um pacote de contexto por ticket**, não o ZIP inteiro como texto. As instruções de projeto estão em [AGENTS.md](AGENTS.md).

```sh
python tooling/workspace.py validate
python tooling/seal-workspace.py --check
python tooling/workspace.py next --limit 3
python tooling/workspace.py packet ZN-0001 --out packets/ZN-0001.md
```

## Como ler os arquivos

| Representação | Significado |
|---|---|
| Código existente + `arquivo.ts.plan.md` | Implementação parcial preservada; plano da evolução ao lado. Não é aceite da spec. |
| `arquivo.ts` contendo apenas comentários `@zoen-plan` | Pseudocódigo no caminho reservado. Sem exports, respostas falsas ou funcionalidade executável. |
| `arquivo.json.plan.md`, `arquivo.sql.plan.md`, configurações `.plan.md` | Plano no diretório de destino, sem criar JSON permissivo, migração no-op, certificado falso ou deploy acidental. |
| Documento de runbook | Procedimento planejado com pré-condições, falha, reparo e prova; não comprova operação em produção. |

Os caminhos **condicionais** vêm das permissões dos tickets: só devem virar código quando o ticket realmente precisar deles. Não existe ordem para implementar arquivos inúteis apenas porque foram reservados.

Lockfiles, certificados, segredos, bundles gerados, resultados de provedores e hashes de imagens devem nascer de ferramentas e execuções reais. Seus **planos** existem; seus resultados não foram inventados.

## Estrutura

```text
apps/             edge, web, Eve worker, authority worker, effect worker
packages/         kernel, contracts, Door, Ontology, Eve, clients, adapters, telemetry
packs/            definições de domínios e integrações, sem branches por cliente
runners/          execução isolada e pontes restritas
infra/            perfis operacionais planejados; nenhum deploy implícito
db/               SQL existente e planos condicionais de novas migrações
contracts/        schemas planejados e contratos compartilhados
tests/            testes existentes e pseudocódigo de testes por ticket
journeys/         aceitação transversal e jornadas finais
runbooks/         falha, recuperação, reconciliação e operação por ticket
docs/             apenas documentação vigente e índices de navegação
planning/         catálogo e registros legíveis por máquina; não carregar tudo no contexto
tooling/          ferramentas existentes, gerador e controles de contexto/evidência
archives/         entradas históricas comprimidas; fora da leitura padrão
```

[Mapa completo de arquivos](docs/FILE-MAP.md) · [Specs](docs/specs/README.md) · [Tickets](docs/tickets/README.md) · [Algoritmos](docs/algorithms/README.md) · [Navegador estático](backlog.html).

## Estado real

O código candidato continua parcial. Os 975 checks de produto continuam sem execução e os 325 tickets sem aceite independente. Testes existentes de leis/criptografia e controles de organização não comprovam interfaces, integrações, deploy ou o produto inteiro.

A lista de fontes compiláveis é explícita: os planos não entram no build por glob. Não foram acrescentados mocks de serviços nem modo de funcionamento offline para substituir dependências. O recurso futuro de child scopes de SPEC-044 permanece apenas uma capacidade planejada, não um atalho de teste.

[Estado atual](docs/implementation-status.md) · [Protocolo de promoção de plano para código](docs/architecture/assembly-contract.md) · [Política de contexto](docs/context-policy.md).
