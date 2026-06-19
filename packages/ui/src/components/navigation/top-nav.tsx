import type { NavigationItem } from "@hospedex/types";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { ThemeToggle } from "../theme-toggle";
import { BrandLockup } from "./brand-lockup";

export type TopNavProps = {
  label?: string;
  items: readonly NavigationItem[];
  actions?: ReactNode;
  className?: string;
};

export function TopNav({ label, items, actions, className }: TopNavProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandLockup {...(label ? { label } : {})} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
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
        <div className="flex items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
