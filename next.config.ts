import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: ['192.168.86.36', 'localhost:3000'],
};

export default nextConfig;
