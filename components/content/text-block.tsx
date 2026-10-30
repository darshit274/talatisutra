import type { TextBlockData } from "@/lib/validation/content";
import { pickLocale, type Locale } from "@/lib/i18n";

export function TextBlock({ data, locale }: { data: TextBlockData; locale: Locale }) {
  const heading = data.heading ? pickLocale(locale, data.heading, data.headingGu) : null;
  const body = pickLocale(locale, data.body, data.bodyGu);
  const paragraphs = body.split("\n\n").filter((p) => p.trim().length > 0);
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      {heading ? <h1 className="font-heading text-3xl font-semibold tracking-tight">{heading}</h1> : null}
      <div className={heading ? "mt-6 space-y-4 text-muted-foreground" : "space-y-4 text-muted-foreground"}>
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
