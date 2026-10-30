import { cookies } from "next/headers";
import { cache } from "react";
import type { Locale } from "./i18n";

const COOKIE_NAME = "locale";

// Wrapped in cache() so every component on a page that needs the current
// locale shares one cookie read per request (same convention as
// getCurrentUser in lib/auth/session.ts).
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === "gu" ? "gu" : "en";
});

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
