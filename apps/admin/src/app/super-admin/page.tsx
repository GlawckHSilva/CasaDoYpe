import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FadeIn,
  SectionHeader
} from "@hospedex/ui";

import { adminSidebarNavigation, adminTopNavigation } from "../../config/navigation";
import { signOutAction } from "../../lib/auth/actions";
import { requireSuperAdmin } from "../../lib/auth/context";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const context = await requireSuperAdmin();

  return (
    <AppShell
      label="Admin Hospedex"
      navigation={adminTopNavigation}
      sidebar={adminSidebarNavigation}
    >
      <FadeIn className="space-y-6">
        <SectionHeader
          description="Acesso restrito a contas com role super_admin."
          eyebrow="Super Admin"
          title="Area administrativa global"
        />

        <Card className="max-w-2xl">
          <CardHeader>
            <Badge variant="success">Super Admin</Badge>
            <CardTitle>{context.profile.full_name ?? context.profile.email}</CardTitle>
            <CardDescription>
              Contexto global carregado. Nenhum dashboard foi implementado nesta etapa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Sair
              </Button>
            </form>
          </CardContent>
        </Card>
      </FadeIn>
    </AppShell>
  );
}
