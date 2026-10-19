import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Contact details and images shown on the public site.
        </p>
      </div>
      {/* key forces a fresh mount (and so fresh defaultValue initialization for every
          uncontrolled field) after each save — without it, a successful submit
          re-renders this already-mounted client component with new `settings` props
          but the DOM inputs' uncontrolled values never update, and Base UI logs a
          "changing the default value state of an uncontrolled FieldControl" warning. */}
      <SettingsForm key={settings.updatedAt.toISOString()} settings={settings} />
    </div>
  );
}
