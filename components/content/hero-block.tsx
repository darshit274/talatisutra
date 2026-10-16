import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { HeroBlockData } from "@/lib/validation/content";

export function HeroBlock({ data }: { data: HeroBlockData }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{data.heading}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{data.subtext}</p>
      {data.buttons.length > 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {data.buttons.map((button, i) => (
            <Link
              key={button.href + i}
              href={button.href}
              className={buttonVariants(i === 0 ? { size: "lg" } : { variant: "outline", size: "lg" })}
            >
              {button.label}
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
