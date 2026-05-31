import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-expect-error - turbopack property is not in current NextConfig type but is supported in this version
  turbopack: {
    root: process.cwd(),
  },
  // @ts-expect-error - allowedDevOrigins is a valid but untyped property in this next.js fork
  allowedDevOrigins: ['192.168.86.36', 'localhost:3000'],
};

export default nextConfig;
