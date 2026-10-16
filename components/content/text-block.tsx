import type { TextBlockData } from "@/lib/validation/content";

export function TextBlock({ data }: { data: TextBlockData }) {
  const paragraphs = data.body.split("\n\n").filter((p) => p.trim().length > 0);
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      {data.heading ? <h1 className="text-3xl font-semibold tracking-tight">{data.heading}</h1> : null}
      <div className={data.heading ? "mt-6 space-y-4 text-muted-foreground" : "space-y-4 text-muted-foreground"}>
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
