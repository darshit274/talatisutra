import { prisma } from "@/lib/db/prisma";
import type { MaterialKind } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { visibleMaterialsWhere } from "@/lib/queries/materials";

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

export interface CategoryTileData {
  id: string;
  name: string;
  slug: string;
  materialCount: number;
  childCount: number;
}

export interface CategoryMaterialRow {
  id: string;
  title: string;
  kind: MaterialKind;
}

export interface CategoryPageData {
  category: { id: string; name: string };
  breadcrumbs: CategoryNode[];
  children: CategoryTileData[];
  materials: CategoryMaterialRow[];
}

/** Admin: every top-level category's direct material + child counts, regardless of
 * visibility — admins see everything. */
export async function getAdminCategoryRoot(): Promise<{
  topLevel: CategoryTileData[];
  uncategorised: CategoryMaterialRow[];
}> {
  const [categories, uncategorised] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: true, children: true } } },
    }),
    prisma.material.findMany({
      where: { categoryId: null },
      select: { id: true, title: true, kind: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    topLevel: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      materialCount: c._count.materials,
      childCount: c._count.children,
    })),
    uncategorised,
  };
}

/** Admin: one category's breadcrumbs, direct sub-categories, and direct materials.
 * Returns null only if the category id doesn't exist. */
export async function getAdminCategoryPage(id: string): Promise<CategoryPageData | null> {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return null;

  const [nodes, children, materials] = await Promise.all([
    getAllCategoryNodes(),
    prisma.category.findMany({
      where: { parentId: id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: true, children: true } } },
    }),
    prisma.material.findMany({
      where: { categoryId: id },
      select: { id: true, title: true, kind: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    category: { id: category.id, name: category.name },
    breadcrumbs: buildBreadcrumbTrail(nodes, id),
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      materialCount: c._count.materials,
      childCount: c._count.children,
    })),
    materials,
  };
}

/** Direct-visible material count per category, for the whole tree at once — one
 * grouped query rather than one count query per category. */
async function getDirectVisibleCounts(user: SessionUser): Promise<Map<string, number>> {
  const visibilityWhere = user.role === "ADMIN" ? {} : visibleMaterialsWhere(user);
  const grouped = await prisma.material.groupBy({
    by: ["categoryId"],
    where: { AND: [visibilityWhere, { categoryId: { not: null } }] },
    _count: true,
  });
  return new Map(grouped.map((g) => [g.categoryId as string, g._count]));
}

/** Employee: top-level categories that have something visible to `user` anywhere in
 * their subtree, plus directly-uncategorised materials visible to them. A category
 * with nothing visible anywhere underneath it is omitted entirely — it must never
 * render as a dead-end tile (see lib/queries/categories.ts's computeVisibleSubtreeMap). */
export async function getVisibleCategoryRoot(user: SessionUser): Promise<{
  topLevel: CategoryTileData[];
  uncategorised: CategoryMaterialRow[];
}> {
  const [nodes, directCounts, uncategorised] = await Promise.all([
    getAllCategoryNodes(),
    getDirectVisibleCounts(user),
    prisma.material.findMany({
      where: { AND: [visibleMaterialsWhere(user), { categoryId: null }] },
      select: { id: true, title: true, kind: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const visibleSubtree = computeVisibleSubtreeMap(nodes, directCounts);
  const childrenOf = new Map<string | null, CategoryNode[]>();
  for (const node of nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const topLevel = (childrenOf.get(null) ?? [])
    .filter((node) => visibleSubtree.get(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      materialCount: directCounts.get(node.id) ?? 0,
      childCount: (childrenOf.get(node.id) ?? []).filter((child) => visibleSubtree.get(child.id))
        .length,
    }));

  return { topLevel, uncategorised };
}

/** Employee: one category's breadcrumbs, visible sub-categories, and directly-visible
 * materials. Returns null both when the id doesn't exist AND when nothing in its
 * subtree is visible to `user` — the same 404 either way, so a guesser can't tell
 * "wrong id" from "exists but you can't see anything in it" (BUILD-PLAN §7, same
 * principle as getVisibleMaterialById in lib/queries/materials.ts). */
export async function getVisibleCategoryPage(
  user: SessionUser,
  id: string,
): Promise<CategoryPageData | null> {
  const [nodes, directCounts] = await Promise.all([getAllCategoryNodes(), getDirectVisibleCounts(user)]);
  const visibleSubtree = computeVisibleSubtreeMap(nodes, directCounts);

  if (!visibleSubtree.get(id)) return null;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const category = byId.get(id);
  if (!category) return null;

  const childrenOf = new Map<string | null, CategoryNode[]>();
  for (const node of nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const materials = await prisma.material.findMany({
    where: { AND: [visibleMaterialsWhere(user), { categoryId: id }] },
    select: { id: true, title: true, kind: true },
    orderBy: { createdAt: "desc" },
  });

  const children = (childrenOf.get(id) ?? [])
    .filter((node) => visibleSubtree.get(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      materialCount: directCounts.get(node.id) ?? 0,
      childCount: (childrenOf.get(node.id) ?? []).filter((child) => visibleSubtree.get(child.id))
        .length,
    }));

  return {
    category: { id: category.id, name: category.name },
    breadcrumbs: buildBreadcrumbTrail(nodes, id),
    children,
    materials,
  };
}
