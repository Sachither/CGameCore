import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['09f2-197-211-63-56.ngrok-free.app'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
