import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder copy throughout this page — replace with the client's real content,
// brand colours and logo once available (BUILD-PLAN §9/§14).
export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Company Name</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent nec turpis
          vitae justo cursus tincidunt.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/contact" className={buttonVariants({ size: "lg" })}>
            Get in touch
          </Link>
          <Link href="/services" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Our services
          </Link>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:grid-cols-3">
          {[
            {
              title: "Lorem ipsum",
              body: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium.",
            },
            {
              title: "Dolor sit amet",
              body: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit fugit.",
            },
            {
              title: "Consectetur",
              body: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold">Ready to work with us?</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Reach out and we&apos;ll get back to you as soon as we can.
        </p>
        <Link href="/contact" className={buttonVariants({ className: "mt-6" })}>
          Contact us
        </Link>
      </section>
    </div>
  );
}
