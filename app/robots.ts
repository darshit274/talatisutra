import type { MetadataRoute } from "next";

// Scoped carve-out of CLAUDE.md rule 9: the public (marketing) pages are indexable,
// everything else (portal/admin/auth/api) stays disallowed. No sitemap or other SEO
// tooling — out of scope.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/services", "/articles", "/articles/*", "/contact", "/privacy", "/disclaimer"],
      disallow: ["/portal", "/admin", "/api", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/change-password", "/profile"],
    },
  };
}
