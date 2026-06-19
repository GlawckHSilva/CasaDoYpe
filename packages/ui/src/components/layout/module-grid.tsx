import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

export type ModuleCard = {
  title: string;
  description: string;
  status?: "base" | "planned" | "enabled";
  icon?: ReactNode;
};

export type ModuleGridProps = {
  modules: readonly ModuleCard[];
};

const statusLabel = {
  base: "Base",
  planned: "Planejado",
  enabled: "Ativo"
} satisfies Record<NonNullable<ModuleCard["status"]>, string>;

export function ModuleGrid({ modules }: ModuleGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => (
        <Card key={module.title}>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {module.icon ? (
                <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                  {module.icon}
                </span>
              ) : null}
              <div>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </div>
            </div>
            <Badge variant={module.status === "enabled" ? "success" : "secondary"}>
              {statusLabel[module.status ?? "base"]}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-1.5 w-1/3 rounded-full bg-primary" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
