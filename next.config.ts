import type { NextConfig } from "next";

const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  // Body limit para route handlers (default 10MB en Next.js 15)
  middlewareClientMaxBodySize: "25mb",
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
    largePageDataBytes: 128 * 1000 * 1000,
  },
} satisfies NextConfig & { middlewareClientMaxBodySize?: string };

export default nextConfig;
