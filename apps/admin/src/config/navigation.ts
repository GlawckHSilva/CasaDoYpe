import type { NavigationItem } from "@hospedex/types";

export const adminTopNavigation = [
  {
    label: "Painel",
    href: "/"
  },
  {
    label: "Conta",
    href: "/conta"
  },
  {
    label: "Suporte",
    href: "/suporte"
  }
] as const satisfies readonly NavigationItem[];

export const adminSidebarNavigation = [
  {
    label: "Visão geral",
    href: "/"
  },
  {
    label: "Propriedades",
    href: "/propriedades",
    module: "property_management"
  },
  {
    label: "Reservas",
    href: "/reservas",
    module: "reservations"
  },
  {
    label: "Financeiro",
    href: "/financeiro",
    module: "finance"
  },
  {
    label: "Operação",
    href: "/operacao",
    module: "cleaning"
  },
  {
    label: "Super Admin",
    href: "/super-admin",
    module: "feature_flags"
  }
] as const satisfies readonly NavigationItem[];
