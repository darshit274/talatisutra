import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CardGridBlockData } from "@/lib/validation/content";
import { pickLocale, type Locale } from "@/lib/i18n";

export function CardGridBlock({ data, locale }: { data: CardGridBlockData; locale: Locale }) {
  const heading = data.heading ? pickLocale(locale, data.heading, data.headingGu) : null;
  const subtext = data.subtext ? pickLocale(locale, data.subtext, data.subtextGu) : null;
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-16">
        {heading ? <h2 className="font-heading text-2xl font-semibold">{heading}</h2> : null}
        {subtext ? <p className="mt-2 max-w-2xl text-muted-foreground">{subtext}</p> : null}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {data.cards.map((card, i) => (
            <Card key={card.title + i}>
              {card.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served through our own route, not a static asset next/image can optimize
                <img src={`/api/site-images/${card.imageKey}`} alt="" className="h-40 w-full object-cover" />
              ) : null}
              <CardHeader>
                <CardTitle className="text-lg">{pickLocale(locale, card.title, card.titleGu)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{pickLocale(locale, card.body, card.bodyGu)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
