"use client";

import { useActionState, useState } from "react";
import type { SiteSettings } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

      <div className="space-y-2">
        <Label htmlFor="contactHours">Hours</Label>
        <Input id="contactHours" name="contactHours" defaultValue={settings.contactHours} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactAddress">Address</Label>
        <Input id="contactAddress" name="contactAddress" defaultValue={settings.contactAddress} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aboutDisclaimer">About page closing disclaimer</Label>
        <Textarea
          id="aboutDisclaimer"
          name="aboutDisclaimer"
          rows={3}
          defaultValue={settings.aboutDisclaimer}
          required
        />
      </div>

      <SiteImageUploadField label="About photo" value={aboutPhotoKey} onChange={setAboutPhotoKey} />
      <SiteImageUploadField label="Contact map image" value={contactMapImageKey} onChange={setContactMapImageKey} />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
