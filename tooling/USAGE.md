# Ferramentas do workspace

`workspace.py validate` verifica integridade estrutural, rastreabilidade, planos não executáveis e links locais. Não testa funcionalidades futuras.

`workspace.py packet ZN-xxxx --out packets/ZN-xxxx.md` monta um contexto delimitado e inclui o algoritmo, principal, testes e runbook. `next` reutiliza os controles de dependência/conflito/evidência do pacote v4.

`workspace.py scope ZN-xxxx path...` verifica o allowlist do ticket. Mudanças na organização do plano precisam de revisão própria; a ferramenta não concede poder para ampliar escopo.

`workspace.py reference --member <membro-exato>` consulta um membro do arquivo v4 sem descompactá-lo na árvore ativa.

`generate-plans.py --check` compara a renderização com as fontes. Sem `--check`, regenera apenas planos e docs; código promovido deve estar como `existing-with-sidecar`. Sobrescrever código por um plano é erro.

Os scripts Node existentes exercitam o núcleo candidato ou tentam qualificação real. Não são substituídos pelo validador do workspace. `preflight --real` bloqueia legitimamente pré-requisitos ausentes.

`seal-workspace.py --check` verifica os hashes da entrega; mudanças intencionais exigem um novo manifesto revisado, não alteração dos hashes antigos como se fossem originais.

`validate-doc-contracts.py` verifica os schemas e exemplos documentais com a dependência de ferramentas herdada em `requirements.txt`. Não substitui testes do produto.

`package-workspace.py --out /caminho/externo/zoen-workspace.zip` exige Git limpo, selo válido e todos os arquivos selados versionados. Inclui diretórios vazios do Git e exclui outputs não versionados. Execute só após revisar o conteúdo e histórico do repositório.
