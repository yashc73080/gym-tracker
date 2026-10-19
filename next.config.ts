import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CSV imports are posted through a Server Action; full-history exports can exceed the 1 MB default.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // Tailwind v4 via the Turbopack loader (no PostCSS config in this setup).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
