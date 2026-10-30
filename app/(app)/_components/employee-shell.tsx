import type { SessionUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n";
import { MarketingHeader } from "@/app/(marketing)/_components/marketing-header";
import { MarketingFooter } from "@/app/(marketing)/_components/marketing-footer";

/**
 * Non-admin logged-in shell: the same header used on the public site (session-aware —
 * it already renders a Materials/Profile/Sign out menu for a logged-in user), so an
 * employee gets a consistent header whether they're on a public page or in the portal.
 * No left sidebar — admins keep that via AppShell; this is the employee-only flow.
 */
export function EmployeeShell({
  user,
  locale,
  children,
}: {
  user: SessionUser | null;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader user={user} locale={locale} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <MarketingFooter />
    </div>
  );
}
