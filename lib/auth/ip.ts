import { env } from "@/lib/env";

/**
 * Real client IP for rate limiting (BUILD-PLAN §4). Next.js Server Actions and Route
 * Handlers have no access to the raw socket, so behind Nginx the only trustworthy
 * source is X-Forwarded-For, and only once Nginx is confirmed to be setting it
 * (TRUST_PROXY_HOPS > 0, see .env.example and BUILD-PLAN §14). We read the entry
 * TRUST_PROXY_HOPS positions from the RIGHT of that header — never the left-most
 * value, which any client can set to anything.
 *
 * With TRUST_PROXY_HOPS=0 (local dev, no proxy in front of Node), we don't trust the
 * header at all and fall back to a fixed value — there is no reliable way to read the
 * raw socket address from within a Server Action/Route Handler.
 */
export function getClientIp(headersList: Headers): string {
  const hops = env.TRUST_PROXY_HOPS;

  if (hops > 0) {
    const forwardedFor = headersList.get("x-forwarded-for");
    if (forwardedFor) {
      const ips = forwardedFor
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
      const ip = ips[ips.length - hops];
      if (ip) return ip;
    }

    const realIp = headersList.get("x-real-ip");
    if (realIp) return realIp.trim();
  }

  return "127.0.0.1";
}
