# Site de Reservas da Casa

Site em React + Tailwind para mostrar fotos da casa, calcular valores, exibir calendario de disponibilidade e receber dados de check-in/check-out com Supabase.

## Rodar localmente

```bash
npm install
npm run dev
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Rode o SQL em `supabase/schema.sql` no SQL Editor.
3. Crie pelo menos uma linha na tabela `properties`.
4. Adicione fotos em `property_photos`, usando URLs publicas ou arquivos do Supabase Storage.
5. Crie um usuario em Authentication para acessar a administracao.
6. Copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_OWNER_WHATSAPP=5511999999999
```

Nunca coloque a `service_role key` no frontend.
Para pagamentos online, configure estes segredos na Edge Function do Supabase, nao no `.env` do React:

```bash
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=seu-access-token
supabase functions deploy create-payment-preference
```

## Fotos

O jeito mais simples e seguro e subir as fotos no Supabase Storage, deixar o bucket publico ou gerar URLs publicas, e adicionar essas URLs pelo painel Admin do site.

## WhatsApp e confirmacao

Cadastre o WhatsApp do proprietario no painel Admin ou em `VITE_OWNER_WHATSAPP`.
Quando o cliente solicita uma reserva, o site cria a reserva como `pending` e abre uma mensagem pronta no WhatsApp.
Depois que voce aceitar, entre no Admin e clique em `Confirmar`; a reserva muda para `confirmed` e o calendario passa a bloquear essas datas.

## Pagamento

O app calcula o total e cria a reserva como pendente. Para Pix/cartao, a Edge Function `supabase/functions/create-payment-preference` cria um link do Mercado Pago e salva esse link na reserva. Para dinheiro e cheque, marque o recebimento manualmente no Admin.

Fluxo recomendado:

1. Cliente escolhe Pix, cartao, dinheiro ou cheque.
2. O site envia a solicitacao pelo WhatsApp.
3. Para Pix/cartao, a mensagem inclui o link de pagamento quando a Edge Function estiver configurada.
4. Para dinheiro/cheque, voce recebe em maos e clica em `Recebido`.
5. O painel `Caixa` mostra recebido, a receber e previsao.

Nao processe cartao direto no navegador.

## Publicar no GitHub

Depois de criar o repositorio no GitHub:

```bash
git init
git add .
git commit -m "Cria site de reservas"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git push -u origin main
```
