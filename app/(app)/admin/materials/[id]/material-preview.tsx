"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { MaterialKind } from "@prisma/client";
import { Button } from "@/components/ui/button";

/** Collapsed behind a "View file" button by default, rather than always rendering
 * an iframe/image — opening every material's edit page shouldn't eagerly load the
 * file itself. */
export function MaterialPreview({
  fileUrl,
  kind,
  title,
}: {
  fileUrl: string;
  kind: MaterialKind;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Eye className="size-4" aria-hidden="true" />
        View file
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Hide preview
      </Button>
      <div className="max-w-3xl overflow-hidden rounded-lg border">
        {kind === "PDF" ? (
          <iframe src={fileUrl} title={title} className="h-[70vh] w-full" />
        ) : kind === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element -- served through our own auth-checked route, not a static asset next/image can optimize
          <img src={fileUrl} alt={title} className="mx-auto max-h-[70vh] w-full object-contain" />
        ) : (
          <div className="flex h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No preview available for this file type — use Download above to view it.
          </div>
        )}
      </div>
    </div>
  );
}
