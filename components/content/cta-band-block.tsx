import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { CtaBandBlockData } from "@/lib/validation/content";
import { pickLocale, type Locale } from "@/lib/i18n";

export function CtaBandBlock({ data, locale }: { data: CtaBandBlockData; locale: Locale }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 text-center">
      <h2 className="font-heading text-2xl font-semibold">{pickLocale(locale, data.heading, data.headingGu)}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
        {pickLocale(locale, data.subtext, data.subtextGu)}
      </p>
      <Link href={data.button.href} className={buttonVariants({ className: "mt-6" })}>
        {pickLocale(locale, data.button.label, data.button.labelGu)}
      </Link>
    </section>
  );
}
