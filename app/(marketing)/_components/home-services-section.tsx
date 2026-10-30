import Link from "next/link";
import type { ArticleCategory } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { resolveIcon } from "@/lib/articles/icons";
import { pickLocale, type Locale } from "@/lib/i18n";

export function HomeServicesSection({ categories, locale }: { categories: ArticleCategory[]; locale: Locale }) {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Services we offer</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">What you will find here</p>

        {categories.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {categories.map((category, i) => {
              const Icon = resolveIcon(category.icon);
              return (
                <Link
                  key={category.id}
                  href={`/articles?category=${category.slug}`}
                  className="rounded-lg border p-5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-3 font-heading text-lg font-medium">
                    {pickLocale(locale, category.name, category.nameGu)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pickLocale(locale, category.shortDescription, category.shortDescriptionGu)}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : null}

        <Link href="/services" className={buttonVariants({ variant: "outline", className: "mt-8" })}>
          All services
        </Link>
      </div>
    </section>
  );
}
