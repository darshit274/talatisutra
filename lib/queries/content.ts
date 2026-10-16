import { prisma } from "@/lib/db/prisma";
import { SitePage, type ContentBlock } from "@prisma/client";

/** No visibility scoping of any kind — this is public content, not department-restricted
 * materials (spec §3). */
export async function getPageBlocks(page: SitePage): Promise<ContentBlock[]> {
  return prisma.contentBlock.findMany({
    where: { page },
    orderBy: { sortOrder: "asc" },
  });
}

export const SITE_PAGE_PATH: Record<SitePage, string> = {
  HOME: "/",
  ABOUT: "/about",
  SERVICES: "/services",
  CONTACT: "/contact",
};

export const SITE_PAGE_LABEL: Record<SitePage, string> = {
  HOME: "Home",
  ABOUT: "About",
  SERVICES: "Services",
  CONTACT: "Contact",
};

/** Admin URL segments are the lowercase enum value (e.g. "/admin/content/home"). Returns
 * null for anything that doesn't match exactly one of the four pages. */
export function parseSitePageSegment(segment: string): SitePage | null {
  const upper = segment.toUpperCase();
  return upper in SitePage ? (upper as SitePage) : null;
}
