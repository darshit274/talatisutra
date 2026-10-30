import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * An English field paired with its optional Gujarati counterpart — the
 * repeated shape behind every translatable text field in the admin panel.
 * The public site shows the Gujarati value when the visitor has switched
 * language and one was actually typed in, otherwise it falls back to the
 * English value (lib/i18n.ts's pickLocale) — so this field is never
 * required and never blocks saving when left blank.
 */
export function BilingualInput({
  label,
  idBase,
  enName,
  guName,
  enDefaultValue,
  guDefaultValue,
  required,
  type,
  maxLength,
}: {
  label: string;
  idBase: string;
  enName: string;
  guName: string;
  enDefaultValue: string;
  guDefaultValue?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={idBase}>{label}</Label>
      <Input
        id={idBase}
        name={enName}
        type={type}
        defaultValue={enDefaultValue}
        required={required}
        maxLength={maxLength}
      />
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-gu`} className="text-xs font-normal text-muted-foreground">
          {label} — Gujarati (optional, falls back to English)
        </Label>
        <Input
          id={`${idBase}-gu`}
          name={guName}
          defaultValue={guDefaultValue ?? ""}
          maxLength={maxLength}
          className='font-["Noto_Serif_Gujarati"]'
        />
      </div>
    </div>
  );
}
