import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Card, CardContent } from "../ui/card";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        {icon ? (
          <span className="grid h-12 w-12 place-items-center rounded-md bg-secondary text-primary">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
