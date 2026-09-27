import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

// This layout reads the session only to render the header (name, sign-out button). It
// is NOT the auth boundary — Next.js layouts don't re-run on client-side navigation
// between sibling routes, so each page under here calls requireUser()/requireAdmin()
// itself (CLAUDE.md rule 2). The full sidebar/nav from BUILD-PLAN §9 lands in Phase 5.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Employee Portal</span>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user.name}</span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        ) : null}
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
