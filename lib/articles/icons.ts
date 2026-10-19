import {
  FileText,
  Map,
  Landmark,
  GraduationCap,
  Scale,
  Download,
  Tag,
  Folder,
  BookOpen,
  Archive,
  FileCheck,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

export const ICON_OPTIONS: Record<string, LucideIcon> = {
  FileText,
  Map,
  Landmark,
  GraduationCap,
  Scale,
  Download,
  Tag,
  Folder,
  BookOpen,
  Archive,
  FileCheck,
  Newspaper,
};

export const DEFAULT_ICON_KEY = "Tag";

// Falls back to the default rather than crashing a public page if a stored
// icon key is ever missing from ICON_OPTIONS (shouldn't happen — new
// categories always get DEFAULT_ICON_KEY, there's no picker to type an
// arbitrary key — but a render path should never trust stored data blindly).
export function resolveIcon(key: string): LucideIcon {
  return ICON_OPTIONS[key] ?? ICON_OPTIONS[DEFAULT_ICON_KEY];
}
