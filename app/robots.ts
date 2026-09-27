import type { MetadataRoute } from "next";

// The site is internal (CLAUDE.md rule 8) — disallow everything, no sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
