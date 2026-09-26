import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root has another lockfile and a PostCSS config for the Calliotel app.
  // Keep Turbopack rooted in this Next.js app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
