import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (functionality unchanged).
//
// This is a CHEAP COOKIE-PRESENCE CHECK ONLY (CLAUDE.md rule 2) — it cannot query
// Prisma (no edge/Node DB access here) and does not know if the cookie's session is
// still valid, expired, or belongs to a deactivated user. It exists purely to bounce
// obviously-logged-out visitors to /login before they reach a protected page. Every
// actual authorization decision happens server-side in requireUser()/requireAdmin()
// (lib/auth/session.ts), called at the top of each protected page/action/route.
const SESSION_COOKIE = "vw_session";
const PROTECTED_PREFIXES = ["/portal", "/admin", "/change-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
