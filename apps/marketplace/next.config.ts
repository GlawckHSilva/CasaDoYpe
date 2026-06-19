import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@hospedex/feature-flags",
    "@hospedex/types",
    "@hospedex/ui"
  ]
};

export default nextConfig;
