import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { CtaBandBlockData } from "@/lib/validation/content";

export function CtaBandBlock({ data }: { data: CtaBandBlockData }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 text-center">
      <h2 className="text-2xl font-semibold">{data.heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{data.subtext}</p>
      <Link href={data.button.href} className={buttonVariants({ className: "mt-6" })}>
        {data.button.label}
      </Link>
    </section>
  );
}
