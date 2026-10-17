import { Mail, Phone, Clock, MapPin } from "lucide-react";

const ROWS = [
  { icon: Mail, label: "Email", value: "help@talatisutra.in" },
  { icon: Phone, label: "Phone / WhatsApp", value: "+91 98250 00000" },
  { icon: Clock, label: "Hours", value: "Mon–Sat, 10am–6pm" },
  { icon: MapPin, label: "Address", value: "Gandhinagar, Gujarat" },
];

export function ContactDetails() {
  return (
    <div className="space-y-8">
      <dl className="space-y-5">
        {ROWS.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <row.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        Map coming soon
      </div>
    </div>
  );
}
