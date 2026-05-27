# Configurar login social e administradores

## O que ja esta pronto no codigo

- Login/cadastro por e-mail e senha.
- Login social com Google, Facebook e Apple via Supabase OAuth.
- Promocao de usuarios para `admin` dentro do painel, apenas pelo administrador principal.
- Licencas mensais do sistema visiveis e editaveis apenas pelo administrador principal.

## Supabase

1. Rode `supabase/schema.sql` no SQL Editor do Supabase.
2. Em Authentication > URL Configuration, configure:
   - Site URL: `https://casa-do-ype.vercel.app`
   - Redirect URLs:
     - `https://casa-do-ype.vercel.app/**`
     - `http://127.0.0.1:5191/**`
3. Em Authentication > Providers, habilite Google, Facebook e Apple depois de criar os aplicativos em cada plataforma.

## Google

1. Acesse Google Cloud Console.
2. Crie ou selecione um projeto.
3. Configure OAuth Consent Screen.
4. Crie OAuth Client ID do tipo Web application.
5. Adicione em Authorized redirect URIs:
   - `https://SEU-PROJETO.supabase.co/auth/v1/callback`
6. Copie Client ID e Client Secret para Supabase > Authentication > Providers > Google.

## Facebook

1. Acesse Meta for Developers.
2. Crie um App.
3. Ative Facebook Login.
4. Em Valid OAuth Redirect URIs, adicione:
   - `https://SEU-PROJETO.supabase.co/auth/v1/callback`
5. Copie App ID e App Secret para Supabase > Authentication > Providers > Facebook.
6. Garanta que a permissao de e-mail esteja habilitada.

## Apple

1. Acesse Apple Developer.
2. Crie/configure um Service ID para Sign in with Apple.
3. Configure Return URL:
   - `https://SEU-PROJETO.supabase.co/auth/v1/callback`
4. Configure Team ID, Client ID, Key ID e private key no Supabase > Authentication > Providers > Apple.

## Como criar admins

1. A pessoa cria conta pelo e-mail/senha ou entra com Google/Facebook/Apple.
2. Voce entra como administrador principal.
3. Abra Admin > Dados do administrador.
4. Em Administradores Supabase, informe o e-mail do usuario.
5. Clique em Tornar admin.

O administrador principal e definido no codigo/schema como:

- `glawcksilva8@gmail.com`
- `glawcksiva8@gmail.com`
