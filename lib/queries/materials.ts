import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";

/**
 * BUILD-PLAN §5 "The one query that matters" — the single source of truth for what an
 * employee can see. Use this in EVERY employee-facing read: list, detail, and the file
 * stream route. Never re-derive it inline. Admins bypass it entirely (callers check
 * `user.role === "ADMIN"` themselves before deciding whether to apply this at all).
 */
export function visibleMaterialsWhere(user: SessionUser): Prisma.MaterialWhereInput {
  return {
    OR: [
      { visibility: "ALL" },
      user.departmentId
        ? { departments: { some: { departmentId: user.departmentId } } }
        : { id: "__none__" }, // no department → sees only ALL items
    ],
  };
}

const PAGE_SIZE = 20;

export interface MaterialListFilters {
  categoryId?: string;
  kind?: "PDF" | "IMAGE" | "DOCUMENT";
  search?: string;
  page?: number;
}

export interface MaterialListResult {
  items: Awaited<ReturnType<typeof prisma.material.findMany<{ include: typeof materialListInclude }>>>;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const materialListInclude = { category: true } as const;

/**
 * List materials visible to `user`, filtered and paginated. Building the `where`
 * clause as an `AND` array (rather than spreading multiple objects that each have
 * their own top-level `OR` key) matters here — visibleMaterialsWhere() and the text
 * search each need their own `OR`, and a naive `{...a, ...b}` spread would silently
 * drop one of them.
 */
export async function listVisibleMaterials(
  user: SessionUser,
  filters: MaterialListFilters,
): Promise<MaterialListResult> {
  const conditions: Prisma.MaterialWhereInput[] = [];

  if (user.role !== "ADMIN") {
    conditions.push(visibleMaterialsWhere(user));
  }
  if (filters.categoryId) {
    conditions.push({ categoryId: filters.categoryId });
  }
  if (filters.kind) {
    conditions.push({ kind: filters.kind });
  }
  if (filters.search) {
    conditions.push({
      OR: [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ],
    });
  }

  const where: Prisma.MaterialWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const page = filters.page && filters.page > 0 ? filters.page : 1;

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: materialListInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.material.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Single-material read for the detail page and the file-stream route. Returns `null`
 * (not a permission error) when the material doesn't exist or isn't visible to
 * `user` — callers render a 404 either way, so a guesser can't distinguish
 * "wrong id" from "exists but you can't see it" (BUILD-PLAN §7). */
export async function getVisibleMaterialById(user: SessionUser, id: string) {
  const where: Prisma.MaterialWhereInput =
    user.role === "ADMIN" ? { id } : { AND: [{ id }, visibleMaterialsWhere(user)] };

  return prisma.material.findFirst({
    where,
    include: { category: true, departments: { include: { department: true } } },
  });
}

export interface PortalSummary {
  recent: Awaited<ReturnType<typeof prisma.material.findMany<{ include: typeof materialListInclude }>>>;
  categoryCounts: Array<{ id: string; name: string; slug: string; count: number }>;
}

/** Powers /portal: a handful of recently added materials, plus a per-category count —
 * both scoped to what `user` can actually see. */
export async function getPortalSummary(user: SessionUser): Promise<PortalSummary> {
  const where: Prisma.MaterialWhereInput = user.role === "ADMIN" ? {} : visibleMaterialsWhere(user);

  const [recent, categories] = await Promise.all([
    prisma.material.findMany({
      where,
      include: materialListInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: { where } } } },
    }),
  ]);

  return {
    recent,
    categoryCounts: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      count: category._count.materials,
    })),
  };
}
