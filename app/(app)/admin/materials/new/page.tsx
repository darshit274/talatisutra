import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { NewMaterialForm } from "./new-material-form";

export const metadata: Metadata = {
  title: "Upload material",
};

export default async function NewMaterialPage() {
  const [categories, departments] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Upload material</h1>
        <p className="text-sm text-muted-foreground">
          Files are validated by their actual contents, not just the file extension.
        </p>
      </div>

      <NewMaterialForm categories={categories} departments={departments} />
    </div>
  );
}
