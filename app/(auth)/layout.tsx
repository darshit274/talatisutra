import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { ThemeScopeProvider } from "@/components/theme-scope";
import { MarketingHeader } from "@/app/(marketing)/_components/marketing-header";
import { MarketingFooter } from "@/app/(marketing)/_components/marketing-footer";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  return (
    <ThemeScopeProvider className="theme-classical flex min-h-svh flex-col bg-background text-foreground">
      <MarketingHeader user={user} locale={locale} />
      <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
          {children}
        </div>
      </main>
      <MarketingFooter />
    </ThemeScopeProvider>
  );
}
