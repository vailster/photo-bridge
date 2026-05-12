import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore
  turbopack: {
    root: process.cwd(),
  },
  // @ts-ignore
  allowedDevOrigins: ['192.168.86.36', 'localhost:3000'],
};

export default nextConfig;
