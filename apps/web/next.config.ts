import type { NextConfig } from 'next';
import { withContentlayer } from 'next-contentlayer';

const nextConfig: NextConfig = {
  redirects: async () => [
    {
      source: '/docs',
      destination: 'https://docs.usepaykit.dev',
      permanent: true,
    },
    {
      source: '/docs/:path*',
      destination: 'https://docs.usepaykit.dev/:path*',
      permanent: true,
    },
  ],
};

export default withContentlayer(nextConfig);
