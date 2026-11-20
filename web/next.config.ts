import type { NextConfig } from "next";

const INGEST_API_URL = process.env.INGEST_URL || "http://ingest-api:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${INGEST_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
