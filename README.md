# Site de Reservas da Casa

Site em React + Tailwind para mostrar fotos da casa, calcular valores, exibir calendário de disponibilidade e receber dados de check-in/check-out com Supabase.

## Rodar localmente

```bash
npm install
npm run dev
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Rode o SQL em `supabase/schema.sql` no SQL Editor.
3. Crie pelo menos uma linha na tabela `properties`.
4. Adicione fotos em `property_photos`, usando URLs públicas ou arquivos do Supabase Storage.
5. Crie um usuário em Authentication para acessar a administração:
   - E-mail: `glawcksilva8@gmail.com`
   - Senha: defina diretamente no Supabase Auth.
6. Em Authentication > URL Configuration, configure:
   - Site URL: `http://127.0.0.1:5173` em desenvolvimento, ou a URL publicada do site.
   - Redirect URLs: `http://127.0.0.1:5173/**` e a URL publicada do site com `/**`.
7. Copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_OWNER_WHATSAPP=43998108328
VITE_ADMIN_EMAIL=glawcksilva8@gmail.com
VITE_LOCAL_ADMIN_PASSWORD=senha-apenas-para-desenvolvimento-local
```

Nunca coloque a `service_role key` no frontend.
Quando o site estiver publicado, o painel Admin deve usar Supabase Auth. Sem Supabase configurado, o login local funciona apenas durante o desenvolvimento com `npm run dev`; a senha local não deve ser usada como segurança de produção.
Para pagamentos online, configure estes segredos na Edge Function do Supabase, nao no `.env` do React:

```bash
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=seu-access-token
supabase functions deploy create-payment-preference
```

## Fotos

O jeito mais simples e seguro é subir as fotos no Supabase Storage, deixar o bucket público ou gerar URLs públicas, e adicionar essas URLs pelo painel Admin do site.

## Várias casas

O painel Admin permite cadastrar mais de uma casa. Cada casa tem seus próprios dados, fotos, calendário, reservas e caixa. No site público, o cliente escolhe a casa antes de consultar disponibilidade ou solicitar reserva.

## WhatsApp e confirmação

Cadastre o WhatsApp do proprietário no painel Admin ou em `VITE_OWNER_WHATSAPP`.
Quando o cliente solicita uma reserva, o site cria a reserva como `pending` e abre uma mensagem pronta no WhatsApp.
Depois que você aceitar, entre no Admin e clique em `Confirmar`; a reserva muda para `confirmed` e o calendário passa a bloquear essas datas.

## Pagamento

O app calcula o total e cria a reserva como pendente. Para Pix/cartão, a Edge Function `supabase/functions/create-payment-preference` cria um link do Mercado Pago e salva esse link na reserva. Para dinheiro e cheque, marque o recebimento manualmente no Admin.

Fluxo recomendado:

1. Cliente escolhe Pix, cartão, dinheiro ou cheque.
2. O site envia a solicitacao pelo WhatsApp.
3. Para Pix/cartão, a mensagem inclui o link de pagamento quando a Edge Function estiver configurada.
4. Para dinheiro/cheque, você recebe em mãos e clica em `Recebido`.
5. O painel `Caixa` mostra recebido, a receber e previsão.

Não processe cartão direto no navegador.

## Publicar no GitHub

O projeto já tem deploy automático para GitHub Pages em `.github/workflows/deploy-pages.yml`.
No GitHub, entre em Settings > Pages e selecione GitHub Actions como fonte.

Antes de publicar com Supabase, cadastre estas variáveis em Settings > Secrets and variables > Actions > Variables:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_OWNER_WHATSAPP=43998108328
VITE_ADMIN_EMAIL=glawcksilva8@gmail.com
```

Depois de criar o repositório no GitHub:

```bash
git init
git add .
git commit -m "Cria site de reservas"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git push -u origin main
```
