import { requireAdmin } from "@/lib/auth/session";

// Defense in depth (CLAUDE.md rule 4) — a fast bounce for the whole /admin subtree.
// Every individual page under here also calls requireAdmin() itself; this layout
// check alone would not be enough (see the note in app/(app)/layout.tsx).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  return <>{children}</>;
}
