"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { deleteSiteImage } from "@/lib/site-images/storage";
import {
  contentBlockInputSchema,
  extractImageKeys,
  type ContentBlockInput,
} from "@/lib/validation/content";
import { SITE_PAGE_PATH } from "@/lib/queries/content";
import type { SitePage } from "@prisma/client";

export interface ContentBlockFormState {
  error?: string;
}

function parseBlockInput(formData: FormData): { ok: true; value: ContentBlockInput } | { ok: false; error: string } {
  let dataJson: unknown;
  try {
    dataJson = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, error: "Invalid form data." };
  }

  const parsed = contentBlockInputSchema.safeParse({ type: formData.get("type"), data: dataJson });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  return { ok: true, value: parsed.data };
}

function revalidateBlockPage(page: SitePage) {
  revalidatePath(`/admin/content/${page.toLowerCase()}`);
  revalidatePath(SITE_PAGE_PATH[page]);
}

export async function createContentBlock(
  page: SitePage,
  _prevState: ContentBlockFormState,
  formData: FormData,
): Promise<ContentBlockFormState> {
  const admin = await requireAdmin("/admin/content");
  const parsed = parseBlockInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const count = await prisma.contentBlock.count({ where: { page } });
  const block = await prisma.contentBlock.create({
    data: {
      page,
      type: parsed.value.type,
      sortOrder: count,
      data: parsed.value.data,
      updatedById: admin.id,
    },
  });

  await writeAuditLog({
    actor: admin,
    action: "content.block.create",
    entity: "ContentBlock",
    entityId: block.id,
    meta: { page, type: block.type },
    ip: getClientIp(await headers()),
  });

  revalidateBlockPage(page);
  return {};
}

export async function updateContentBlock(
  id: string,
  _prevState: ContentBlockFormState,
  formData: FormData,
): Promise<ContentBlockFormState> {
  const admin = await requireAdmin("/admin/content");
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) {
    return { error: "This block no longer exists." };
  }

  const parsed = parseBlockInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  // A block's type is fixed at creation (spec: "no convert this block's type").
  if (parsed.value.type !== existing.type) {
    return { error: "A block's type can't be changed after creation." };
  }

  const oldKeys = extractImageKeys({ type: existing.type, data: existing.data } as ContentBlockInput);
  const newKeys = extractImageKeys(parsed.value);
  const orphaned = oldKeys.filter((key) => !newKeys.includes(key));

  await prisma.contentBlock.update({
    where: { id },
    data: { data: parsed.value.data, updatedById: admin.id },
  });

  await Promise.all(orphaned.map((key) => deleteSiteImage(key)));

  await writeAuditLog({
    actor: admin,
    action: "content.block.update",
    entity: "ContentBlock",
    entityId: id,
    meta: { page: existing.page, type: existing.type },
    ip: getClientIp(await headers()),
  });

  revalidateBlockPage(existing.page);
  return {};
}

export async function deleteContentBlock(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/content");
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) {
    redirect("/admin/content");
  }

  const keys = extractImageKeys({ type: existing.type, data: existing.data } as ContentBlockInput);

  await prisma.contentBlock.delete({ where: { id } });
  await Promise.all(keys.map((key) => deleteSiteImage(key)));

  await writeAuditLog({
    actor: admin,
    action: "content.block.delete",
    entity: "ContentBlock",
    entityId: id,
    meta: { page: existing.page, type: existing.type },
    ip: getClientIp(await headers()),
  });

  revalidateBlockPage(existing.page);
  redirect(`/admin/content/${existing.page.toLowerCase()}`);
}

export async function moveContentBlock(id: string, direction: "up" | "down"): Promise<void> {
  const admin = await requireAdmin("/admin/content");
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) {
    redirect("/admin/content");
  }

  const siblings = await prisma.contentBlock.findMany({
    where: { page: existing.page },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  // Out-of-range swaps (already first/last) are a no-op, not an error — the UI disables
  // these buttons at the boundary, but the action itself must stay safe if invoked anyway.
  if (swapIndex >= 0 && swapIndex < siblings.length) {
    const other = siblings[swapIndex];
    await prisma.$transaction([
      prisma.contentBlock.update({ where: { id: existing.id }, data: { sortOrder: other.sortOrder } }),
      prisma.contentBlock.update({ where: { id: other.id }, data: { sortOrder: existing.sortOrder } }),
    ]);

    // Every other mutation in this file writes an audit entry (lib/audit.ts: "every other
    // admin mutation ... calls it too rather than waiting for a dedicated pass") — reorder
    // is still a mutation of this row, so it gets one too, even though it's a no-op when
    // already at the boundary (handled above, before this log would ever fire).
    await writeAuditLog({
      actor: admin,
      action: "content.block.reorder",
      entity: "ContentBlock",
      entityId: existing.id,
      meta: { page: existing.page, direction },
      ip: getClientIp(await headers()),
    });

    revalidateBlockPage(existing.page);
  }

  redirect(`/admin/content/${existing.page.toLowerCase()}`);
}
