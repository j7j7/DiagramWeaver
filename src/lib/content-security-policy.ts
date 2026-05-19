/**
 * Content-Security-Policy for static export and `next dev` / `next start`.
 * Permissive enough for Next/Tailwind inline styles, Google Fonts, remote custom icons, and viewer fetches.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: http:",
  "connect-src 'self' https: http:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
].join("; ");
