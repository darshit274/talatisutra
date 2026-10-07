import { getCurrentUser } from "@/lib/auth/session";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/marketing-footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader user={user} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
