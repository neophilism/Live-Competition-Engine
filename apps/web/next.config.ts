import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: [
    "@live-competition-engine/config",
    "@live-competition-engine/db"
  ]
};

export default nextConfig;
