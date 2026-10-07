"use client";

import { useState } from "react";
import Link from "next/link";
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
import { logout } from "@/app/(app)/actions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/information", label: "Information" },
  { href: "/contact", label: "Contact" },
];

const PORTAL_LINKS = [
  { href: "/portal/materials", label: "Materials", icon: FolderOpen },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function MarketingHeader({ user }: { user: SessionUser | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        {/* Wordmark placeholder — swap for the client's real logo (BUILD-PLAN §9/§14) */}
        <Link href="/" className="font-semibold" onClick={closeMobile}>
          TalatiSutra
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
              <Link href="/register" className={buttonVariants({ variant: "ghost" })}>
                Register
              </Link>
              <Link href="/login" className={buttonVariants()}>
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
                    className={buttonVariants({ variant: "ghost", className: "w-full" })}
                    onClick={closeMobile}
                  >
                    Register
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className={buttonVariants({ className: "w-full" })}
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
