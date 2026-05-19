import type {NextConfig} from 'next';
import {CONTENT_SECURITY_POLICY} from './src/lib/content-security-policy';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: CONTENT_SECURITY_POLICY,
          },
        ],
      },
    ];
  },
  allowedDevOrigins: [
    '*.app.github.dev',
    'localhost:9003',
    '127.0.0.1:9003',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
};

export default nextConfig;