"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "./theme-provider";

export type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
