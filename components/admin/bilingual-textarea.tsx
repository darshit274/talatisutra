import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/** Textarea counterpart to BilingualInput — see its own doc comment. */
export function BilingualTextarea({
  label,
  idBase,
  enName,
  guName,
  enDefaultValue,
  guDefaultValue,
  required,
  rows = 3,
  maxLength,
}: {
  label: string;
  idBase: string;
  enName: string;
  guName: string;
  enDefaultValue: string;
  guDefaultValue?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={idBase}>{label}</Label>
      <Textarea
        id={idBase}
        name={enName}
        rows={rows}
        defaultValue={enDefaultValue}
        required={required}
        maxLength={maxLength}
      />
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-gu`} className="text-xs font-normal text-muted-foreground">
          {label} — Gujarati (optional, falls back to English)
        </Label>
        <Textarea
          id={`${idBase}-gu`}
          name={guName}
          rows={rows}
          defaultValue={guDefaultValue ?? ""}
          maxLength={maxLength}
          className='font-["Noto_Serif_Gujarati"]'
        />
      </div>
    </div>
  );
}
