import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SITE_PAGE_LABEL } from "@/lib/queries/content";
import type { SitePage } from "@prisma/client";

export const metadata: Metadata = {
  title: "Site Content",
};

export default async function AdminContentPage() {
  await requireAdmin("/admin/content");

  const counts = await prisma.contentBlock.groupBy({ by: ["page"], _count: true });
  const countByPage = Object.fromEntries(counts.map((c) => [c.page, c._count])) as Record<SitePage, number>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Site Content</h1>
        <p className="text-sm text-muted-foreground">
          Edit the text, images and sections on each public page.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {(Object.keys(SITE_PAGE_LABEL) as SitePage[]).map((page) => (
          <Link
            key={page}
            href={`/admin/content/${page.toLowerCase()}`}
            className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <p className="font-medium">{SITE_PAGE_LABEL[page]}</p>
            <p className="text-sm text-muted-foreground">
              {countByPage[page] ?? 0} block{(countByPage[page] ?? 0) === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
