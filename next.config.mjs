/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig = {
  // Self-contained server bundle in .next/standalone (used by the Dockerfile).
  output: 'standalone',
  // Server-only libraries that should be required at runtime, not bundled.
  serverExternalPackages: ['xlsx', '@googleapis/sheets'],
  poweredByHeader: false,
  // dev-only Next.js badge: off, so it never covers the navbar or the copilot button
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  // Everything now lives on the single Overview page; keep old bookmarks working.
  async redirects() {
    return ['/sales', '/registration', '/collection', '/projects'].map((source) => ({ source, destination: '/', permanent: false }));
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
