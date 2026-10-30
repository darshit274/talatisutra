import { FileText, Image as ImageIcon, FileType } from "lucide-react";
import type { MaterialKind } from "@prisma/client";

export const MATERIAL_KIND_ICON = {
  PDF: FileText,
  IMAGE: ImageIcon,
  DOCUMENT: FileType,
} as const satisfies Record<MaterialKind, typeof FileText>;
