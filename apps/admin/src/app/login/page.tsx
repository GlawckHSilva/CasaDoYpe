import Link from "next/link";
import { redirect } from "next/navigation";

import { Button, Input, Label } from "@hospedex/ui";

import { AuthCard } from "../../components/auth/auth-card";
import { signInAction } from "../../lib/auth/actions";
import { getAuthContext, getRoleHomePath } from "../../lib/auth/context";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const context = await getAuthContext();
  if (context) redirect(getRoleHomePath(context.role));

  const { message } = await searchParams;

  return (
    <AuthCard
      description="Entre para acessar o painel administrativo."
      footerHref="/cadastro"
      footerLabel="Criar conta"
      footerText="Ainda nao tem acesso?"
      message={message}
      title="Entrar"
    >
      <form action={signInAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            autoComplete="current-password"
            id="password"
            minLength={6}
            name="password"
            required
            type="password"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link className="text-sm font-medium text-primary hover:underline" href="/recuperar-senha">
            Esqueci minha senha
          </Link>
          <Button type="submit">Entrar</Button>
        </div>
      </form>
    </AuthCard>
  );
}
