// Security headers for all responses. CommonJS so next.config.js and tests can share it.

/**
 * @param {{ isProd: boolean; https: boolean }} opts
 * @returns {{ key: string; value: string }[]}
 */
function securityHeaders({ isProd, https }) {
  const csp = [
    "default-src 'self'",
    // Next.js injects inline bootstrap scripts; 'unsafe-eval' is needed only by the dev server (HMR).
    `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
    // Fonts are self-hosted by next/font; inline styles come from React/Next.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // YouTube preview thumbnails of the portfolio videos.
    "img-src 'self' data: blob: https://i.ytimg.com",
    "media-src 'self'",
    // Portfolio videos load (click-to-play) from the privacy-enhanced YouTube domain.
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    `connect-src 'self'${isProd ? '' : ' ws: wss:'}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isProd && https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    ...(isProd && https ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
  ];
}

const privateHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
];

module.exports = { securityHeaders, privateHeaders };
