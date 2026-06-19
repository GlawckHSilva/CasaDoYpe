# Hospedex V2

Base monorepo do Hospedex V2.

Esta etapa cria apenas a estrutura do projeto, os apps Next.js, os pacotes compartilhados, o esqueleto Python/FastAPI e a organização inicial para Supabase, Redis, OpenAI, feature flags e multi-tenant.

## Apps

- `apps/marketplace`: `hospedex.com.br`
- `apps/gestao`: `gestao.hospedex.com.br`
- `apps/admin`: `admin.hospedex.com.br`

## Comandos

```bash
npm install
npm run dev:marketplace
npm run dev:gestao
npm run dev:admin
npm run build
npm run typecheck
```

## Limite da etapa 1

Não há login, banco de dados, reservas, pagamentos, IA, APIs de domínio, relatórios, inventário, CRM, calendário, chat, apps mobile ou integrações externas.
