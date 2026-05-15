import type { NextConfig } from "next";

const devOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  ...(devOrigin && { allowedDevOrigins: [devOrigin] }),
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/auth/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
