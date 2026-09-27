import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Portal",
};

export default async function PortalPage() {
  const user = await requireUser("/portal");

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
      <p className="text-sm text-muted-foreground">
        The materials library (list, filters, search) lands here in Phase 4.
      </p>
    </div>
  );
}
