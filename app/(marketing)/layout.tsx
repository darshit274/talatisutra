import { getCurrentUser } from "@/lib/auth/session";
import { ThemeScopeProvider } from "@/components/theme-scope";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/marketing-footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <ThemeScopeProvider className="theme-classical flex min-h-svh flex-col bg-background text-foreground">
      <MarketingHeader user={user} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </ThemeScopeProvider>
  );
}
