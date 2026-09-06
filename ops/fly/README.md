# Fly stubs (D04) — sem deploy automático

Integrador (`ops/fly/**`). Stubs para o app candidato **`zoen-rebuild`**.

## Regras

1. **Não** executar `fly apps create`, `fly deploy`, `fly mpg create`, `fly storage create` ou equivalente a partir deste diretório sem um EX de ativação explícito e confirmação de custo.
2. **Não** apontar estes stubs para o app legado `zoen` nem reutilizar seus volumes/secrets como cutover.
3. Auth Fly presente na máquina do maintainer **não** equivale a autorização de gasto neste freeze (H07).
4. Imagem: `ops/containers/application.Dockerfile` (porta interna **4310**).

## Próximos passos (fora deste stub)

1. Criar app `zoen-rebuild` (ou nome ratificado) sob custo consciente.
2. Provisionar PG + object store reais e secrets do redesign.
3. Build/push da imagem e prova de health + restore do perfil `d04-hosted-retained-v1` somente.
