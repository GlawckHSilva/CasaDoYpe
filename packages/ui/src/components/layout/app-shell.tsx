import type { NavigationItem } from "@hospedex/types";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { TopNav } from "../navigation/top-nav";
import { SidebarNav } from "../navigation/sidebar-nav";

export type AppShellProps = {
  children: ReactNode;
  label: string;
  navigation: readonly NavigationItem[];
  sidebar?: readonly NavigationItem[];
  actions?: ReactNode;
  className?: string;
};

export function AppShell({
  children,
  label,
  navigation,
  sidebar,
  actions,
  className
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav actions={actions} items={navigation} label={label} />
      <div
        className={cn(
          "mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6",
          sidebar?.length ? "lg:grid-cols-[248px_1fr]" : "grid-cols-1",
          className
        )}
      >
        {sidebar?.length ? (
          <aside className="hidden lg:block">
            <div className="sticky top-22 rounded-lg border bg-card p-2">
              <SidebarNav items={sidebar} />
            </div>
          </aside>
        ) : null}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
