import { redirect } from "next/navigation";

import { Button, Input, Label } from "@hospedex/ui";

import { AuthCard } from "../../components/auth/auth-card";
import { signUpAction } from "../../lib/auth/actions";
import { getAuthContext, getRoleHomePath } from "../../lib/auth/context";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const context = await getAuthContext();
  if (context) redirect(getRoleHomePath(context.role));

  const { message } = await searchParams;

  return (
    <AuthCard
      description="Crie uma conta para solicitar acesso ao Hospedex."
      footerHref="/login"
      footerLabel="Entrar"
      footerText="Ja tem conta?"
      message={message}
      title="Cadastro"
    >
      <form action={signUpAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome</Label>
          <Input autoComplete="name" id="full_name" name="full_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            autoComplete="new-password"
            id="password"
            minLength={6}
            name="password"
            required
            type="password"
          />
        </div>
        <Button className="w-full" type="submit">
          Criar conta
        </Button>
      </form>
    </AuthCard>
  );
}
