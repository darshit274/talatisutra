"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FolderOpen, UserCircle, LogOut } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n";
import { logout } from "@/app/(app)/actions";
import { setLocale } from "@/app/(marketing)/actions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/articles", label: "Articles" },
  { href: "/contact", label: "Contact" },
];

const PORTAL_LINKS = [
  { href: "/portal/materials", label: "Materials", icon: FolderOpen },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

// A circular seal mark: two concentric accent-colored rings around a centered
// Gujarati "ત" (spec §5 / Appendix A — ported from the mock's inline SVG).
function Wordmark() {
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="19" fill="none" stroke="var(--primary)" strokeWidth="1.5" />
      <circle cx="21" cy="21" r="14" fill="none" stroke="var(--primary)" strokeWidth="1" />
      <text
        x="21"
        y="21"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--primary)"
        fontSize="16"
        fontFamily="var(--font-noto-gujarati)"
      >
        ત
      </text>
    </svg>
  );
}

export function MarketingHeader({ user, locale }: { user: SessionUser | null; locale: Locale }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="border-b bg-muted/40">
        <div className="mx-auto flex h-9 max-w-5xl items-center justify-between gap-4 px-4 text-xs text-muted-foreground">
          <p className="truncate">Information resource for Talati-cum-Mantri employees of Gujarat</p>
          <div className="flex items-center gap-2">
            <form action={setLocale}>
              <input type="hidden" name="next" value={pathname} />
              <input type="hidden" name="locale" value="en" />
              <button
                type="submit"
                className={locale === "en" ? "font-medium text-foreground" : "hover:text-foreground"}
                disabled={locale === "en"}
              >
                English
              </button>
            </form>
            <span aria-hidden="true">/</span>
            <form action={setLocale}>
              <input type="hidden" name="next" value={pathname} />
              <input type="hidden" name="locale" value="gu" />
              <button
                type="submit"
                className={`font-["Noto_Serif_Gujarati"] ${locale === "gu" ? "font-medium text-foreground" : "hover:text-foreground"}`}
                disabled={locale === "gu"}
              >
                ગુજરાતી
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={closeMobile}>
          <Wordmark />
          <span className="leading-tight">
            <span className="block font-heading text-lg font-semibold">
              Talati<span className="text-primary">sutra</span>
            </span>
            <span className='block font-["Noto_Serif_Gujarati"] text-xs text-muted-foreground'>
              તલાટી સૂત્ર
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted"
                  aria-label="Open account menu"
                >
                  <Menu className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {PORTAL_LINKS.map((link) => (
                    <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
                      <link.icon className="size-4" aria-hidden="true" />
                      {link.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <form action={logout}>
                    <DropdownMenuItem
                      variant="destructive"
                      nativeButton
                      render={<button type="submit" className="w-full" />}
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Sign out
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/register" className={buttonVariants({ variant: "accent-ghost" })}>
                Register
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline-accent" })}>
                User Login
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <nav className="border-t px-4 py-4 md:hidden">
          <ul className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={closeMobile}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li className="border-t pt-4 text-sm font-medium">{user.name}</li>
                {PORTAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={closeMobile}
                    >
                      <link.icon className="size-4" aria-hidden="true" />
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 text-sm text-destructive"
                      onClick={closeMobile}
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </form>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link
                    href="/register"
                    className={buttonVariants({ variant: "accent-ghost", className: "w-full" })}
                    onClick={closeMobile}
                  >
                    Register
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className={buttonVariants({ variant: "outline-accent", className: "w-full" })}
                    onClick={closeMobile}
                  >
                    User Login
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
