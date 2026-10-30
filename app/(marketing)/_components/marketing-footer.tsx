import Link from "next/link";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { pickLocale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/articles", label: "Articles" },
  { href: "/contact", label: "Contact" },
];

export async function MarketingFooter() {
  const year = new Date().getFullYear();
  const [settings, categories, locale] = await Promise.all([
    getSiteSettings(),
    getArticleCategories(),
    getLocale(),
  ]);

  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <p className="font-heading text-lg font-semibold">
            Talati<span className="text-primary">sutra</span>
          </p>
          <p className='font-["Noto_Serif_Gujarati"] text-xs text-muted-foreground'>તલાટી સૂત્ર</p>
          <p className="mt-3 text-sm text-muted-foreground">
            GRs, circulars, forms and study material for Talati-cum-Mantri employees,
            organised by subject and date.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium">Pages</p>
          <nav className="mt-3 flex flex-col gap-2">
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

        {categories.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Categories</p>
            <nav className="mt-3 flex flex-col gap-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/articles?category=${category.slug}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pickLocale(locale, category.name, category.nameGu)}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium">Contact</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {settings.contactEmail}
            <br />
            {settings.contactPhone}
            <br />
            {pickLocale(locale, settings.contactAddress, settings.contactAddressGu)}
          </p>
        </div>
      </div>

      <div className="border-t px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} Talatisutra. An independent resource — not an official
            Government of Gujarat website.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/disclaimer" className="hover:text-foreground">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
