import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Paquetes del monorepo que se compilan dentro de Next (TypeScript directo).
  transpilePackages: ["@fogoneria/kernel", "@fogoneria/sdk", "@fogoneria/contracts"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
