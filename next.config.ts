import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://www.google.com https://maps.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const IMPORT_UPLOAD_BODY_LIMIT = "55mb" as const;

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "unzipper"],
  // Ensure sharp + pnpm-nested deps/binaries are copied into serverless functions.
  // Partial includes of only `sharp/**` leave transitive deps (e.g. detect-libc) out.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/detect-libc/**/*",
      "./node_modules/.pnpm/sharp@*/node_modules/**/*",
      "./node_modules/.pnpm/@img+*/**/*",
      "./node_modules/.pnpm/detect-libc@*/node_modules/**/*",
    ],
  },
  experimental: {
    // Excel + imágenes embebidas pueden superar 10 MB (límite por defecto de Next).
    proxyClientMaxBodySize: IMPORT_UPLOAD_BODY_LIMIT,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
