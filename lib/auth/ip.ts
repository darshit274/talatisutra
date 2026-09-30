import { env } from "@/lib/env";

/**
 * Real client IP for rate limiting (BUILD-PLAN §4). Next.js Server Actions and Route
 * Handlers have no access to the raw socket, so behind Nginx the only trustworthy
 * source is X-Forwarded-For, and only once Nginx is confirmed to be setting it
 * (TRUST_PROXY_HOPS > 0, see .env.example and BUILD-PLAN §14). We read the entry
 * TRUST_PROXY_HOPS positions from the RIGHT of that header — never the left-most
 * value, which any client can set to anything.
 *
 * With TRUST_PROXY_HOPS=0 (local dev, no proxy in front of Node), we deliberately
 * don't read X-Forwarded-For at all and fall back to a fixed value instead — not
 * because the header is unavailable (Next's own server actually fills it in with the
 * real socket address when a client sends none, which is convenient but version- and
 * platform-specific behavior, not a documented contract) but because trusting *any*
 * forwarded header by default, before an operator has confirmed a real proxy sits in
 * front and is the one setting it, is the wrong default: it would let a request
 * straight from the internet claim whatever IP it likes.
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
