import type { NavigationItem } from "@hospedex/types";

export const marketplaceNavigation = [
  {
    label: "Hospedagens",
    href: "/"
  },
  {
    label: "Destinos",
    href: "/destinos"
  },
  {
    label: "Favoritos",
    href: "/favoritos"
  }
] as const satisfies readonly NavigationItem[];
