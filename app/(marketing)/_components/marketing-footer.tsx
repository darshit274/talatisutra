import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-semibold">TalatiSutra</p>
          <p className="text-sm text-muted-foreground">
            123 Placeholder Street, Some City
            <br />
            (555) 555-5555 · hello@example.com
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2">
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
      </div>

      <div className="border-t px-4 py-4">
        <p className="mx-auto max-w-5xl text-xs text-muted-foreground">
          &copy; {year} TalatiSutra. Placeholder address/contact details — pending client
          copy and logo (BUILD-PLAN §14).
        </p>
      </div>
    </footer>
  );
}
