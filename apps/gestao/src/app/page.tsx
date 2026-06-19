import { BarChart3, Boxes, CalendarDays, SlidersHorizontal } from "lucide-react";

import {
  AppShell,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FadeIn,
  ModuleGrid,
  SectionHeader
} from "@hospedex/ui";

import { gestaoNavigation } from "../config/navigation";
import { ManagementActionCards } from "../components/gerenciamento/action-cards";

const managementModules = [
  {
    title: "Reservas",
    description: "Fluxos preparados para aprovação manual e automática.",
    status: "base",
    icon: <CalendarDays className="h-5 w-5" />
  },
  {
    title: "Operação",
    description: "Estrutura para limpeza, equipe e inventário.",
    status: "base",
    icon: <Boxes className="h-5 w-5" />
  },
  {
    title: "Métricas",
    description: "Base visual para indicadores e relatórios.",
    status: "base",
    icon: <BarChart3 className="h-5 w-5" />
  }
] as const;

export default function GestaoHomePage() {
  return (
    <AppShell label="Gestao Hospedex" navigation={gestaoNavigation}>
      <FadeIn className="space-y-8">
        <SectionHeader
          description="Uma base modular para proprietários administrarem hospedagens com clareza."
          eyebrow="Gestão"
          title="Hospedex para proprietários"
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <Badge variant="info">Multi-tenant</Badge>
              <CardTitle className="text-2xl">Tudo opcional por design</CardTitle>
              <CardDescription>
                A estrutura separa módulos, permissões e flags desde a primeira etapa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {["Proprietário", "Funcionários", "Hóspede", "Super Admin"].map((role) => (
                <div className="rounded-md border bg-secondary/35 p-4" key={role}>
                  <p className="text-sm font-semibold">{role}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <CardTitle>Configuração por licença</CardTitle>
              <CardDescription>
                A base de produto já considera planos, permissões e módulos liberados.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <ManagementActionCards />

        <ModuleGrid modules={managementModules} />
      </FadeIn>
    </AppShell>
  );
}
