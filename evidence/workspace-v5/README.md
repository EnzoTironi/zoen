# Validação desta entrega

Leia [summary.json](summary.json) para escopo, contagens e limites; [structure.json](structure.json) para rastreabilidade e organização. [core-report.json](core-report.json) registra o commit e o runtime que realmente executaram o núcleo. [real-preflight.json](real-preflight.json) registra os bloqueios atuais de serviços reais.

Estes relatórios não aceitam tickets nem implementam os cenários planejados. Logs completos dos controles, testes de núcleo e mutações selecionadas acompanham os relatórios. Os hashes de `summary.json` cobrem os demais resultados; este resumo e este README são metadados, não atestação independente.

A validação após extração do ZIP é entregue em um arquivo externo ao ZIP, para evitar um hash circular do próprio arquivo.
