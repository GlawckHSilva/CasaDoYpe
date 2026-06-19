import { redirect } from "next/navigation";

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

import { adminSidebarNavigation, adminTopNavigation } from "../config/navigation";
import { signOutAction } from "../lib/auth/actions";
import { requireAuth } from "../lib/auth/context";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const context = await requireAuth();

  if (context.role === "super_admin") {
    redirect("/super-admin");
  }

  return (
    <AppShell
      label="Admin Hospedex"
      navigation={adminTopNavigation}
      sidebar={adminSidebarNavigation}
    >
      <FadeIn className="space-y-6">
        <SectionHeader
          description="Sessao carregada com profile, tenant, role, permissoes e feature flags."
          eyebrow="Acesso protegido"
          title="Painel administrativo"
        />

        <Card className="max-w-2xl">
          <CardHeader>
            <Badge variant="success">Autenticado</Badge>
            <CardTitle>{context.profile.full_name ?? context.profile.email}</CardTitle>
            <CardDescription>
              Role atual: {context.role}. Tenant: {context.tenant?.name ?? "nao vinculado"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>Permissoes: {context.permissions.length}</span>
            <span>Feature flags: {context.featureFlags.length}</span>
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
