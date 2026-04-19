import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['fdce-197-211-63-170.ngrok-free.app'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
