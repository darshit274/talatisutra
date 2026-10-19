"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/articles/categories";
import type { ArticleCategory } from "@prisma/client";

// A client component so SelectValue's function-child (mapping the stored enum value
// to its display label) never has to cross the server/client boundary — a Server
// Component can't pass a function as a child into a Client Component (it isn't
// serializable), which is exactly what broke here before this was split out.
export function ArticleCategoryFilter({ category }: { category?: ArticleCategory }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="filter-category-trigger">Category</Label>
        <Select name="category" defaultValue={category ?? ""}>
          <SelectTrigger id="filter-category-trigger" className="w-56">
            <SelectValue placeholder="All categories">
              {(value: ArticleCategory | "") => (value ? CATEGORY_META[value].label : "All categories")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {CATEGORY_ORDER.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_META[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Apply</Button>
    </form>
  );
}
