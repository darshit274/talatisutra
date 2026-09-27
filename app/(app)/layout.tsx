import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "./_components/app-shell";

// This layout reads the session only to render the shell (nav, name, sign-out). It is
// NOT the auth boundary — Next.js layouts don't re-run on client-side navigation
// between sibling routes, so each page under here calls requireUser()/requireAdmin()
// itself (CLAUDE.md rule 2). The admin nav section only renders for admins, but that
// too is display-only: every /admin/* page independently calls requireAdmin().
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return <AppShell user={user}>{children}</AppShell>;
}
