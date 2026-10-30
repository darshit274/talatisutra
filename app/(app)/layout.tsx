import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "./_components/app-shell";
import { EmployeeShell } from "./_components/employee-shell";

// This layout reads the session only to render the shell (nav, name, sign-out). It is
// NOT the auth boundary — Next.js layouts don't re-run on client-side navigation
// between sibling routes, so each page under here calls requireUser()/requireAdmin()
// itself (CLAUDE.md rule 2). The admin nav section only renders for admins, but that
// too is display-only: every /admin/* page independently calls requireAdmin().
//
// Admins keep the sidebar AppShell (unchanged). Everyone else (employees, and the
// logged-out case while a redirect to /login is in flight) gets the public-site-style
// EmployeeShell — same header as the marketing pages, session-aware, no left sidebar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user?.role === "ADMIN") {
    return <AppShell user={user}>{children}</AppShell>;
  }

  // Covers both a logged-in employee and the logged-out case (the page itself is
  // about to redirect to /login via requireUser()/requireAdmin() — this just avoids a
  // flash of a bare/unstyled page while that happens).
  return <EmployeeShell user={user}>{children}</EmployeeShell>;
}
