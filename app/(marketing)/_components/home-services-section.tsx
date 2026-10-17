import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/articles/categories";

export function HomeServicesSection() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Services we offer</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">What you will find here</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {CATEGORY_ORDER.map((category, i) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <Link
                key={category}
                href={meta.path}
                className="rounded-lg border p-5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-3 font-heading text-lg font-medium">{meta.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{meta.shortDescription}</p>
              </Link>
            );
          })}
        </div>

        <Link href="/services" className={buttonVariants({ variant: "outline", className: "mt-8" })}>
          All services
        </Link>
      </div>
    </section>
  );
}
