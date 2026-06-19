import { Building2, Home, Hotel, MapPin } from "lucide-react";

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

import { marketplaceNavigation } from "../config/navigation";

const propertySegments = [
  {
    title: "Casas de temporada",
    description: "Estadias privativas com identidade local.",
    status: "base",
    icon: <Home className="h-5 w-5" />
  },
  {
    title: "Pousadas",
    description: "Acolhimento independente com operação organizada.",
    status: "base",
    icon: <Building2 className="h-5 w-5" />
  },
  {
    title: "Pequenos hotéis",
    description: "Hospedagens compactas com presença digital própria.",
    status: "base",
    icon: <Hotel className="h-5 w-5" />
  }
] as const;

export default function MarketplaceHomePage() {
  return (
    <AppShell label="Hospedex" navigation={marketplaceNavigation}>
      <FadeIn className="space-y-8">
        <SectionHeader
          description="Hospedagens independentes em uma experiência direta, clara e premium."
          eyebrow="Marketplace"
          title="Hospedex"
        />

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="info">Brasil</Badge>
                <Badge variant="outline">Canal direto</Badge>
              </div>
              <CardTitle className="text-2xl">Hospedagens com operação própria</CardTitle>
              <CardDescription>
                Casas, pousadas e pequenos hotéis com uma vitrine consistente para o
                hóspede.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {["Curadoria", "Disponibilidade", "Confiança"].map((label) => (
                <div className="rounded-md border bg-secondary/35 p-4" key={label}>
                  <p className="text-sm font-semibold">{label}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                <MapPin className="h-5 w-5" />
              </span>
              <CardTitle>Presença regional</CardTitle>
              <CardDescription>
                Base preparada para guias locais, avaliações e serviços extras.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <ModuleGrid modules={propertySegments} />
      </FadeIn>
    </AppShell>
  );
}
