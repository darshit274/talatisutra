"use client";

import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MaterialsFilterBar({
  categories,
  selectedCategorySlug,
  selectedKind,
  search,
}: {
  categories?: Category[];
  selectedCategorySlug?: string;
  selectedKind?: "PDF" | "IMAGE" | "DOCUMENT";
  search?: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      {categories ? (
        <div className="space-y-2">
          <Label htmlFor="category-trigger">Category</Label>
          <Select name="category" defaultValue={selectedCategorySlug ?? ""}>
            <SelectTrigger id="category-trigger" className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.slug}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="kind-trigger">Type</Label>
        <Select name="kind" defaultValue={selectedKind ?? ""}>
          <SelectTrigger id="kind-trigger" className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="IMAGE">Image</SelectItem>
            <SelectItem value="DOCUMENT">Document</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Title or description"
          className="w-56"
        />
      </div>

      <Button type="submit">Apply</Button>
    </form>
  );
}
