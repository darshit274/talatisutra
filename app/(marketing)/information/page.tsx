import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Information",
};

// Placeholder gallery/copy — replace with the client's real photos and information
// (BUILD-PLAN §14). The tiles below stand in for images until then.
export default function InformationPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Information</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur vel diam
        eget mi eleifend congue.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex aspect-square items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
          >
            <ImageIcon className="size-8" aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="mt-12 space-y-4 text-muted-foreground">
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
          doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore.
        </p>
        <p>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit,
          sed quia consequuntur magni dolores eos qui ratione voluptatem sequi
          nesciunt.
        </p>
      </div>
    </div>
  );
}
