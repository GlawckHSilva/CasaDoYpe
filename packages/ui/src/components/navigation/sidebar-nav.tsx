import type { NavigationItem } from "@hospedex/types";
import Link from "next/link";

import { cn } from "../../lib/utils";

export type SidebarNavProps = {
  items: readonly NavigationItem[];
  className?: string;
};

export function SidebarNav({ items, className }: SidebarNavProps) {
  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Navegação lateral">
      {items.map((item) => (
        <Link
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
