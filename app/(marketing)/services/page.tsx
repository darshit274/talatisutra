import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Services",
};

const SERVICES = [
  {
    title: "Service one",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent nec turpis vitae justo cursus tincidunt.",
  },
  {
    title: "Service two",
    body: "Curabitur vel diam eget mi eleifend congue. Vestibulum ante ipsum primis in faucibus orci luctus.",
  },
  {
    title: "Service three",
    body: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
  },
  {
    title: "Service four",
    body: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni.",
  },
];

// Placeholder copy — replace with the client's real services (BUILD-PLAN §14).
export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Our services</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minima
        veniam, quis nostrum exercitationem ullam corporis.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {SERVICES.map((service) => (
          <Card key={service.title}>
            <CardHeader>
              <CardTitle>{service.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{service.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
