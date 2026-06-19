import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    // O app Gestao depende dos packages privados do monorepo.
    // Declarar a raiz evita falha no build isolado da Vercel.
    root: monorepoRoot
  },
  transpilePackages: [
    "@hospedex/feature-flags",
    "@hospedex/types",
    "@hospedex/ui"
  ]
};

export default nextConfig;
