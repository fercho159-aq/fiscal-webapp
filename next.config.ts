import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
