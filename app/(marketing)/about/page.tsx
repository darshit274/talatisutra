import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

// Placeholder copy — replace with the client's real company story (BUILD-PLAN §14).
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">About us</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent nec turpis
          vitae justo cursus tincidunt. Curabitur vel diam eget mi eleifend congue.
          Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere
          cubilia curae.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
          doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore
          veritatis et quasi architecto beatae vitae dicta sunt explicabo.
        </p>
        <p>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit,
          sed quia consequuntur magni dolores eos qui ratione voluptatem sequi
          nesciunt.
        </p>
      </div>

      <h2 className="mt-12 text-xl font-semibold">Our values</h2>
      <ul className="mt-4 grid gap-4 text-muted-foreground sm:grid-cols-3">
        {["Integrity", "Quality", "Reliability"].map((value) => (
          <li key={value} className="rounded-lg border p-4">
            <p className="font-medium text-foreground">{value}</p>
            <p className="mt-1 text-sm">
              Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
