import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const user = await requireAdmin("/admin");

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Admin — {user.name}</h1>
      <p className="text-sm text-muted-foreground">
        Counts, recent audit entries, and the rest of the dashboard land here in Phase 5.
      </p>
    </div>
  );
}
