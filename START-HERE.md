# Início da execução

## 1. Entenda o estado sem absorver o histórico inteiro

Leia [AGENTS.md](AGENTS.md), [estado atual](docs/implementation-status.md) e [contrato de montagem](docs/architecture/assembly-contract.md). Não extraia as versões antigas na raiz nem use seus handoffs como instruções atuais.

## 2. Verifique o workspace

```sh
python tooling/workspace.py validate
python tooling/seal-workspace.py --check
python tooling/generate-plans.py --check
python -m unittest discover -s tooling/execution -p 'test_*.py'
node tooling/verify-core.mjs
node tooling/mutations.mjs
```

Os dois últimos comandos exercitam o código candidato que já existia; não contam como os testes ainda planejados. O compilador local utilizado deve ser reportado, não confundido com a versão de destino.

## 3. Selecione um ticket com dependências aceitas

```sh
python tooling/workspace.py next --limit 3
python tooling/workspace.py packet ZN-0001 --out packets/ZN-0001.md
```

O primeiro ticket permanece ZN-0001. O pacote inclui a leitura normativa, o plano do arquivo principal, testes, runbook e resultados exigidos das dependências. A ferramenta impõe um limite e falha em vez de remover requisitos silenciosamente.

## 4. Implemente, não apenas renomeie

Leia a implementação existente quando houver. Execute o segmento do ticket; não copie o algoritmo do módulo em todos os arquivos. Promova o plano para um sidecar antes de substituir seus comentários por código, segundo o [contrato](docs/architecture/assembly-contract.md). Atualize os registros de fontes e a composição somente quando houver implementação real.

Não crie um lockfile à mão, um schema `{}`, uma migração vazia ou uma resposta de sucesso temporária. Serviço ausente bloqueia o teste correspondente. Credenciais e qualificação de API dependem do ambiente real.

## 5. Evidência e aceite

O validador de evidência herdado foi preservado em `tooling/execution/core.py`. Aceite exige os checks exatos, commit/lock/perfil, artefatos verificáveis e revisão independente. [Regras de evidência](docs/testing/evidence-protocol.md).

```sh
python tooling/workspace.py scope ZN-0022 packages/ontology/src/authority/guards.ts
node tooling/preflight.mjs --real
```

O preflight pode bloquear legitimamente quando faltarem Node de destino, dependências, lock, PostgreSQL ou configuração real. Não reduzir as exigências para obter verde.

## 6. Ao entregar o próximo incremento

Inclua diff, testes realmente executados, falhas, dependências bloqueadas, evidência independente e estado dos tickets. Registre alterações intencionais no manifesto; não reaproveite hashes antigos como prova do código novo.
