import { prisma } from "@/lib/db/prisma";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

/** Every category in the tree, cheap at this scale (dozens of rows, not thousands) —
 * fetched once and used to build breadcrumbs and subtree-visibility in memory rather
 * than walking parent pointers with one query per level. */
export async function getAllCategoryNodes(): Promise<CategoryNode[]> {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** Walks `parentId` pointers from `categoryId` up to the root, root-first. Categories
 * are never re-parented after creation, so this can never loop. */
export function buildBreadcrumbTrail(nodes: CategoryNode[], categoryId: string): CategoryNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const trail: CategoryNode[] = [];
  let current = byId.get(categoryId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

/**
 * For each category, whether anything is visible to the current user anywhere in its
 * subtree — its own direct materials, or recursively any descendant's. `directVisibleCounts`
 * maps categoryId -> count of materials *directly* in that category that this user can
 * see (callers compute this with `visibleMaterialsWhere`, lib/queries/materials.ts).
 * Used to decide whether a category tile should render at all for an employee — a
 * category with zero visible materials and zero non-empty descendants must not appear
 * as a navigable dead end.
 */
export function computeVisibleSubtreeMap(
  nodes: CategoryNode[],
  directVisibleCounts: Map<string, number>,
): Map<string, boolean> {
  const childrenOf = new Map<string, CategoryNode[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const result = new Map<string, boolean>();

  function hasVisible(node: CategoryNode): boolean {
    const cached = result.get(node.id);
    if (cached !== undefined) return cached;
    const ownCount = directVisibleCounts.get(node.id) ?? 0;
    const children = childrenOf.get(node.id) ?? [];
    const visible = ownCount > 0 || children.some(hasVisible);
    result.set(node.id, visible);
    return visible;
  }

  for (const node of nodes) hasVisible(node);
  return result;
}
