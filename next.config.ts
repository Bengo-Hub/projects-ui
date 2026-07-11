import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // On Windows, the standalone output step uses symlinks and fails with EPERM unless
  // Developer Mode is on. Set SKIP_STANDALONE=true for local Windows builds; leave unset
  // in Docker/CI (Linux) so the standalone bundle is produced.
  ...(process.env.SKIP_STANDALONE !== 'true' && { output: 'standalone' as const }),
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
