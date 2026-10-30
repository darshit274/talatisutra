"use client";

import { useActionState, useState } from "react";
import type { SiteSettings } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BilingualInput } from "@/components/admin/bilingual-input";
import { BilingualTextarea } from "@/components/admin/bilingual-textarea";
import { SiteImageUploadField } from "@/app/(app)/admin/content/site-image-upload-field";
import { updateSiteSettings, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = {};

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState(updateSiteSettings, initialState);
  const [aboutPhotoKey, setAboutPhotoKey] = useState<string | null>(settings.aboutPhotoKey);
  const [contactMapImageKey, setContactMapImageKey] = useState<string | null>(settings.contactMapImageKey);

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-lg border p-6">
      <input type="hidden" name="aboutPhotoKey" value={aboutPhotoKey ?? ""} />
      <input type="hidden" name="contactMapImageKey" value={contactMapImageKey ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" defaultValue={settings.contactEmail} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactPhone">Contact phone</Label>
        <Input id="contactPhone" name="contactPhone" defaultValue={settings.contactPhone} required />
      </div>

      <BilingualInput
        label="Hours"
        idBase="contactHours"
        enName="contactHours"
        guName="contactHoursGu"
        enDefaultValue={settings.contactHours}
        guDefaultValue={settings.contactHoursGu ?? ""}
        required
      />

      <BilingualInput
        label="Address"
        idBase="contactAddress"
        enName="contactAddress"
        guName="contactAddressGu"
        enDefaultValue={settings.contactAddress}
        guDefaultValue={settings.contactAddressGu ?? ""}
        required
      />

      <BilingualTextarea
        label="About page closing disclaimer"
        idBase="aboutDisclaimer"
        enName="aboutDisclaimer"
        guName="aboutDisclaimerGu"
        enDefaultValue={settings.aboutDisclaimer}
        guDefaultValue={settings.aboutDisclaimerGu ?? ""}
        required
      />

      <SiteImageUploadField label="About photo" value={aboutPhotoKey} onChange={setAboutPhotoKey} />
      <SiteImageUploadField label="Contact map image" value={contactMapImageKey} onChange={setContactMapImageKey} />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
