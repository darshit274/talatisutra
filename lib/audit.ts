import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { Prisma } from "@prisma/client";

/**
 * BUILD-PLAN §7 requires this on material upload; every other admin mutation in
 * Phase 5 calls it too rather than waiting for Phase 6's dedicated pass — cheaper to
 * add alongside each mutation than to retrofit later.
 *
 * `AuditLog.userId` has no FK relation (a log entry must survive the actor's row
 * being deleted later), so the actor's name/email are captured into `meta` at write
 * time instead of joined at read time.
 */
export async function writeAuditLog(params: {
  actor: SessionUser;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  const { actor, action, entity, entityId, meta, ip } = params;
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action,
      entity,
      entityId,
      ip: ip ?? undefined,
      meta: {
        actorName: actor.name,
        actorEmail: actor.email,
        ...meta,
      } as Prisma.InputJsonValue,
    },
  });
}
