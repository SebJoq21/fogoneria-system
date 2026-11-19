import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` es solo para el Dockerfile (copia `.next/standalone`). En Vercel
  // rompe `onBuildComplete` con ENOENT de `next-server.js.nft.json` (Next 16.3 +
  // adapter de Vercel), así que allí se deja el output por defecto.
  output: process.env.VERCEL ? undefined : "standalone",
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
