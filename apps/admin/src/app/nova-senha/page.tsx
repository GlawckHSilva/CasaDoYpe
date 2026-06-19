import { Button, Input, Label } from "@hospedex/ui";

import { AuthCard } from "../../components/auth/auth-card";
import { updatePasswordAction } from "../../lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function NewPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <AuthCard
      description="Defina uma nova senha para continuar."
      footerHref="/login"
      footerLabel="Entrar"
      footerText="Senha ja alterada?"
      message={message}
      title="Nova senha"
    >
      <form action={updatePasswordAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
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
          Atualizar senha
        </Button>
      </form>
    </AuthCard>
  );
}
