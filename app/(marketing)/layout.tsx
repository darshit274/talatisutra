import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { ThemeScopeProvider } from "@/components/theme-scope";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/marketing-footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  return (
    <ThemeScopeProvider className="theme-classical flex min-h-svh flex-col bg-background text-foreground">
      <MarketingHeader user={user} locale={locale} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </ThemeScopeProvider>
  );
}
