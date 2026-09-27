import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface AdminDashboardSummary {
  employeeCount: number;
  activeEmployeeCount: number;
  materialCount: number;
  unreadEnquiryCount: number;
  recentAudit: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    actorName: string | null;
    createdAt: Date;
  }>;
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const [employeeCount, activeEmployeeCount, materialCount, unreadEnquiryCount, auditRows] =
    await Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
      prisma.material.count(),
      prisma.contactEnquiry.count({ where: { isRead: false } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  return {
    employeeCount,
    activeEmployeeCount,
    materialCount,
    unreadEnquiryCount,
    // AuditLog.userId has no FK relation (rows must survive the actor being deleted),
    // so the actor's name was captured into `meta` at write time (lib/audit.ts).
    recentAudit: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      actorName: (row.meta as { actorName?: string } | null)?.actorName ?? null,
      createdAt: row.createdAt,
    })),
  };
}

const ADMIN_MATERIALS_PAGE_SIZE = 20;

export interface AdminMaterialListFilters {
  categoryId?: string;
  kind?: "PDF" | "IMAGE";
  search?: string;
  page?: number;
}

const adminMaterialInclude = {
  category: true,
  uploadedBy: true,
  departments: { include: { department: true } },
} as const;

/** Unlike lib/queries/materials.ts, this never applies visibility scoping — admins see
 * every material regardless of department. */
export async function listMaterialsForAdmin(filters: AdminMaterialListFilters) {
  const conditions: Prisma.MaterialWhereInput[] = [];
  if (filters.categoryId) conditions.push({ categoryId: filters.categoryId });
  if (filters.kind) conditions.push({ kind: filters.kind });
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
      include: adminMaterialInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_MATERIALS_PAGE_SIZE,
      take: ADMIN_MATERIALS_PAGE_SIZE,
    }),
    prisma.material.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: ADMIN_MATERIALS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_MATERIALS_PAGE_SIZE)),
  };
}
