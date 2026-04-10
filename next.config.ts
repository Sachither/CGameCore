import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['260f-197-211-63-67.ngrok-free.app'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
