"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ArticleCategory } from "@prisma/client";

// A client component so SelectValue's function-child (mapping the stored
// category id to its display name) never has to cross the server/client
// boundary — a Server Component can't pass a function as a child into a
// Client Component (it isn't serializable), which is exactly what broke
// here before this was split out.
export function ArticleCategoryFilter({
  category,
  categories,
}: {
  category?: string;
  categories: ArticleCategory[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="filter-category-trigger">Category</Label>
        <Select name="category" defaultValue={category ?? ""}>
          <SelectTrigger id="filter-category-trigger" className="w-56">
            <SelectValue placeholder="All categories">
              {(value: string | "") =>
                value ? categories.find((c) => c.id === value)?.name : "All categories"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Apply</Button>
    </form>
  );
}
