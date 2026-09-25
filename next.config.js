const { privateHeaders, securityHeaders } = require('./security-headers');

const path = require('node:path');

const siteUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows a verification build next to a running `next dev` (which owns .next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Docker image: `NEXT_OUTPUT=standalone npm run build` produces a self-contained server.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  images: {
    // Only local images (public/) are optimised; the optimiser is not an open proxy.
    remotePatterns: [],
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  poweredByHeader: false,
  // The parent folder has its own lockfile; trace dependencies from this project only.
  outputFileTracingRoot: path.join(__dirname),
  // Native Argon2 bindings must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ['@node-rs/argon2'],
  async headers() {
    const base = securityHeaders({ isProd: process.env.NODE_ENV === 'production', https: siteUrl.startsWith('https://') });
    return [
      { source: '/:path*', headers: base },
      // CRM and private APIs: never indexed, never cached by browsers or CDNs.
      { source: '/admin', headers: privateHeaders },
      { source: '/admin/:path*', headers: privateHeaders },
      { source: '/api/admin/:path*', headers: privateHeaders },
      { source: '/api/auth/:path*', headers: privateHeaders },
      { source: '/api/cron/:path*', headers: privateHeaders },
      { source: '/api/bookings', headers: privateHeaders },
      { source: '/api/tours', headers: privateHeaders },
      { source: '/api/health', headers: privateHeaders },
      { source: '/api/ready', headers: privateHeaders },
    ];
  },
};

module.exports = nextConfig;
