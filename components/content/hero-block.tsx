import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { HeroBlockData } from "@/lib/validation/content";
import { pickLocale, type Locale } from "@/lib/i18n";

export function HeroBlock({ data, locale }: { data: HeroBlockData; locale: Locale }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 text-center">
      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        {pickLocale(locale, data.heading, data.headingGu)}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
        {pickLocale(locale, data.subtext, data.subtextGu)}
      </p>
      {data.buttons.length > 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {data.buttons.map((button, i) => (
            <Link
              key={button.href + i}
              href={button.href}
              className={buttonVariants(i === 0 ? { size: "lg" } : { variant: "outline", size: "lg" })}
            >
              {pickLocale(locale, button.label, button.labelGu)}
            </Link>
          ))}
        </div>
      ) : null}
      {data.imageKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served through our own route, not a static asset next/image can optimize
        <img
          src={`/api/site-images/${data.imageKey}`}
          alt=""
          className="mx-auto mt-10 max-h-96 w-full max-w-3xl object-contain"
        />
      ) : null}
    </section>
  );
}
