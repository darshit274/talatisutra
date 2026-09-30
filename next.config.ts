import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// BUILD-PLAN §9. Applied only in production — Turbopack/webpack's dev tooling (Fast
// Refresh, the dev error overlay) relies on patterns a strict CSP would otherwise
// block, and dev mode isn't the surface these headers protect anyway.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Safe to send unconditionally once TLS is live in production — Nginx/certbot
  // terminates it (BUILD-PLAN §14).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // frame-ancestors 'self' (never 'none' / X-Frame-Options: DENY) — /portal/materials/[id]
  // embeds the PDF viewer in a same-origin <iframe> pointed at
  // /api/materials/[id]/file. 'self' still blocks any other site from framing us.
  //
  // script-src needs 'unsafe-inline': without it, the browser silently drops every
  // <script>self.__next_f.push(...)</script> tag Next uses to stream RSC/hydration
  // data, so React never hydrates ANY page — every client component goes dead (dialogs,
  // dropdowns, etc.) while native <form> submissions keep working via progressive
  // enhancement, masking the failure. A nonce-based CSP would avoid 'unsafe-inline' but
  // requires per-request middleware to mint the nonce — not viable here, since Next
  // 16.3.6 has a confirmed bug where ANY proxy.ts/middleware matching a route breaks
  // Server Action body parsing in production (reproduced with a minimal test case;
  // narrowing the matcher does not help). We removed proxy.ts entirely for that reason
  // (auth is enforced per-route via requireUser()/requireAdmin(), not at the edge), so
  // 'unsafe-inline' is the only currently-viable option. default-src 'self' still blocks
  // loading any *external* script, and frame-ancestors still blocks clickjacking.
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    if (!isProduction) return [];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
