import { ThemeScopeProvider } from "@/components/theme-scope";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeScopeProvider className="theme-classical flex min-h-svh items-center justify-center bg-muted/40 p-4 text-foreground">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        {children}
      </div>
    </ThemeScopeProvider>
  );
}
