import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for container deploys.
  output: "standalone",
};

export default nextConfig;
