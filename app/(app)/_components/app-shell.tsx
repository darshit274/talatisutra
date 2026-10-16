"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Tags,
  Building2,
  Users,
  Mail,
  Home,
  UserCircle,
  Menu,
  X,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { logout } from "../actions";

const PORTAL_LINKS = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/materials", label: "Materials", icon: FolderOpen },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/materials", label: "Materials", icon: FolderOpen },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/content", label: "Site Content", icon: LayoutTemplate },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/employees", label: "Users", icon: Users },
  { href: "/admin/enquiries", label: "Enquiries", icon: Mail },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <nav className="space-y-6 p-4">
      <div className="space-y-1">
        <p className="px-3 text-xs font-medium text-muted-foreground">Portal</p>
        {PORTAL_LINKS.map((link) => (
          <NavLink
            key={link.href}
            {...link}
            active={pathname === link.href}
            onNavigate={closeMobile}
          />
        ))}
      </div>

      {isAdmin ? (
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium text-muted-foreground">Admin</p>
          {ADMIN_LINKS.map((link) => (
            <NavLink
              key={link.href}
              {...link}
              active={
                pathname === link.href ||
                // "/admin" itself would prefix-match every admin sub-route, so only
                // apply prefix matching to the deeper links.
                (link.href !== "/admin" && pathname.startsWith(`${link.href}/`))
              }
              onNavigate={closeMobile}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="font-semibold">{isAdmin ? "Admin Portal" : "User Portal"}</span>
        </div>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/profile"
              className="hidden text-muted-foreground hover:text-foreground sm:inline"
            >
              {user.name}
            </Link>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        ) : null}
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r md:block">{sidebarContent}</aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/30"
              onClick={closeMobile}
            />
            <aside className="relative z-50 h-full w-64 overflow-y-auto bg-background shadow-lg">
              {sidebarContent}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
