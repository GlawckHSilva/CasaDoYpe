# Supabase

Estrutura inicial para migrations, policies, seeds e testes SQL.

Nesta etapa não há schema, tabelas, RLS ou dados seed.

Quando as migrations começarem, novas tabelas expostas pela Data API devem declarar `GRANT` explicitamente junto de `ENABLE ROW LEVEL SECURITY` e das policies.
