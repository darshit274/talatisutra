"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Article } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_META } from "@/lib/articles/categories";
import type { SliderBlockData } from "@/lib/validation/content";

type EnrichedSlide = SliderBlockData["slides"][number] & { articles: Article[] };

const AUTOPLAY_MS = 6500;

function usePrefersReducedMotion(): boolean {
  // Lazy initializer reads the real value on the client's first render instead of
  // setState-ing it from inside an effect (this project's lint flags that as a
  // cascading-render risk — same reasoning as ContentBlockFormDialog's own note on
  // this). SSR has no window, so the server-rendered value is always false; the
  // client's first render corrects it before paint.
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function SliderBlock({ slides }: { slides: EnrichedSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Autoplay stops entirely under prefers-reduced-motion (WCAG 2.3.3), and
    // pauses while a pointer or keyboard focus is anywhere in the slider (WCAG
    // 2.2.2) — review finding M-5.
    if (slides.length <= 1 || paused || reducedMotion) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [slides.length, paused, reducedMotion]);

  if (slides.length === 0) return null;
  const slide = slides[active];
  const category = CATEGORY_META[slide.category];
  const hasPdf = slide.articles.some((a) => a.pdfKey);

  return (
    <section
      className="border-b"
      aria-roledescription="carousel"
      aria-label="Featured resolutions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-medium text-primary">{slide.kicker}</p>
          <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{slide.title}</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{slide.subtext}</p>
          <Link href={category.path} className={buttonVariants({ variant: "outline-accent", size: "lg", className: "mt-8" })}>
            {slide.ctaLabel}
          </Link>
        </div>

        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-medium">Latest resolutions</h2>
            {hasPdf ? <Badge variant="accent-outline">PDF</Badge> : null}
          </div>
          {slide.articles.length > 0 ? (
            <ul className="mt-4 divide-y">
              {slide.articles.map((article) => (
                <li key={article.id} className="py-3">
                  <Link href={`/articles/${article.id}`} className="block hover:underline">
                    <p className="text-xs text-muted-foreground">
                      {article.publishedAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-1 text-sm font-medium">{article.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No resolutions published in this category yet.
            </p>
          )}
          <Link
            href={category.path}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Browse the full collection →
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-4 pb-10">
        <button
          type="button"
          onClick={() => setActive((i) => (i - 1 + slides.length) % slides.length)}
          aria-label="Previous slide"
          className="rounded-full border p-1.5 hover:bg-muted/50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <span className="text-xs tabular-nums text-muted-foreground">
          {String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>

        <div className="flex items-center gap-2" role="group" aria-label="Slide navigation">
          {slides.map((s, i) => (
            <button
              key={s.category + i}
              type="button"
              aria-current={i === active ? "true" : undefined}
              aria-label={`Show slide ${i + 1} of ${slides.length}`}
              onClick={() => setActive(i)}
              className={`size-2 rounded-full ${i === active ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setActive((i) => (i + 1) % slides.length)}
          aria-label="Next slide"
          className="rounded-full border p-1.5 hover:bg-muted/50"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
