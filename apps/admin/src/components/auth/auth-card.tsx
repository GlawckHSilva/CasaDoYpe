import Link from "next/link";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@hospedex/ui";

export type AuthCardProps = {
  title: string;
  description: string;
  message?: string | undefined;
  children: ReactNode;
  footerLabel: string;
  footerHref: string;
  footerText: string;
};

export function AuthCard({
  title,
  description,
  message,
  children,
  footerLabel,
  footerHref,
  footerText
}: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {message ? (
            <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {children}
          <p className="text-center text-sm text-muted-foreground">
            {footerText}{" "}
            <Link className="font-semibold text-primary hover:underline" href={footerHref}>
              {footerLabel}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
