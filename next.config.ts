import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
    largePageDataBytes: 128 * 1000 * 1000,
  },
};

export default nextConfig;
