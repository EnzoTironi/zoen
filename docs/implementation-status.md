# Estado da implementação

**Parcial, não aceita e não qualificada para produção.** Esta entrega reorganiza o código candidato e adiciona planos. Não implementa Eve, WhatsApp, Studio, Rivet ou o restante da plataforma apenas por criar suas pastas.

O inventário em `planning/candidate-files.json` registra 40 arquivos de aplicação, testes e SQL herdados. As fontes compiláveis estão em `planning/runtime-sources.json`; os planos não entram nessa seleção.

Há implementações iniciais de valores, reconciliação, guardas, executor semântico, cliente/CLI, adapters reais e alguns helpers de apps. O serviço completo e os adapters externos ainda precisam ser compilados e testados contra as dependências reais admitidas. O runtime de destino não foi admitido por este trabalho.

Os 325 tickets e 975 checks de produto permanecem não aceitos/não executados. Os testes do código inicial, mesmo quando passam novamente, não substituem esses checks.

## Limites que devem continuar visíveis

O candidato usa foundation ligada à imagem, visibilidade inicial limitada, negação de sessões de app não qualificadas e implantação não admitida. Persistência completa de sessões/links, runtime releases, camada web acessível, filas/efeitos completos, isolamento, dados densos, operação institucional e execução financeira continuam trabalho.

Não existe lockfile genuíno neste pacote. As versões diretas herdadas são candidatas a confirmar no ambiente real, não uma composição certificada. O preflight real deve bloquear enquanto faltarem runtime, lock, dependências e serviços.

## Como o estado evolui

Uma implementação nova remove o marcador de plano somente depois de registrar o sidecar, atualiza o inventário explícito de build, conecta a operação ao caminho real e executa seus testes. O aceite usa evidência independente e não um contador de arquivos preenchidos.
