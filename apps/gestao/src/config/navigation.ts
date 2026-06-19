import type { NavigationItem } from "@hospedex/types";

export const gestaoNavigation = [
  {
    label: "Produto",
    href: "/"
  },
  {
    label: "Operação",
    href: "/operacao"
  },
  {
    label: "Planos",
    href: "/planos"
  }
] as const satisfies readonly NavigationItem[];
