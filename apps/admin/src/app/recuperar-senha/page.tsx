import { redirect } from "next/navigation";

import { Button, Input, Label } from "@hospedex/ui";

import { AuthCard } from "../../components/auth/auth-card";
import { resetPasswordAction } from "../../lib/auth/actions";
import { getAuthContext, getRoleHomePath } from "../../lib/auth/context";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const context = await getAuthContext();
  if (context) redirect(getRoleHomePath(context.role));

  const { message } = await searchParams;

  return (
    <AuthCard
      description="Informe seu email para receber as instrucoes."
      footerHref="/login"
      footerLabel="Voltar"
      footerText="Lembrou sua senha?"
      message={message}
      title="Recuperar senha"
    >
      <form action={resetPasswordAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <Button className="w-full" type="submit">
          Enviar instrucoes
        </Button>
      </form>
    </AuthCard>
  );
}
