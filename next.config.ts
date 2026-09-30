import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Knowledge-base uploads go through a Server Action (default limit is 1 MB).
      // Keep in sync with MAX_UPLOAD_BYTES in src/app/actions.ts
      bodySizeLimit: '11mb',
    },
  },
};

export default nextConfig;
