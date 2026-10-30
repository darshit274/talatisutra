import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CardGridBlockData } from "@/lib/validation/content";

export function CardGridBlock({ data }: { data: CardGridBlockData }) {
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-16">
        {data.heading ? <h2 className="font-heading text-2xl font-semibold">{data.heading}</h2> : null}
        {data.subtext ? <p className="mt-2 max-w-2xl text-muted-foreground">{data.subtext}</p> : null}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {data.cards.map((card, i) => (
            <Card key={card.title + i}>
              {card.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served through our own route, not a static asset next/image can optimize
                <img src={`/api/site-images/${card.imageKey}`} alt="" className="h-40 w-full object-cover" />
              ) : null}
              <CardHeader>
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
