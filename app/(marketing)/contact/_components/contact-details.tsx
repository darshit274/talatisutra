import { Mail, Phone, Clock, MapPin } from "lucide-react";
import { pickLocale, type Locale } from "@/lib/i18n";

type ContactSettings = {
  contactEmail: string;
  contactPhone: string;
  contactHours: string;
  contactHoursGu: string | null;
  contactAddress: string;
  contactAddressGu: string | null;
  contactMapImageKey: string | null;
};

export function ContactDetails({ settings, locale }: { settings: ContactSettings; locale: Locale }) {
  const rows = [
    { icon: Mail, label: "Email", value: settings.contactEmail },
    { icon: Phone, label: "Phone / WhatsApp", value: settings.contactPhone },
    { icon: Clock, label: "Hours", value: pickLocale(locale, settings.contactHours, settings.contactHoursGu) },
    { icon: MapPin, label: "Address", value: pickLocale(locale, settings.contactAddress, settings.contactAddressGu) },
  ];

  return (
    <div className="space-y-8">
      <dl className="space-y-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <row.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {settings.contactMapImageKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served from STORAGE_DIR, not a static asset next/image can optimize
        <img
          src={`/api/site-images/${settings.contactMapImageKey}`}
          alt=""
          className="aspect-square w-full rounded-lg border object-cover"
        />
      ) : (
        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
          Map coming soon
        </div>
      )}
    </div>
  );
}
