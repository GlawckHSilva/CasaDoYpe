import { redirect } from "next/navigation";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hospedex/ui";

import { signOutAction } from "../../lib/auth/actions";
import { getAuthContext } from "../../lib/auth/context";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acesso nao liberado</CardTitle>
          <CardDescription>
            Sua conta existe, mas ainda nao possui tenant ou permissao administrativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button className="w-full" type="submit" variant="outline">
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
