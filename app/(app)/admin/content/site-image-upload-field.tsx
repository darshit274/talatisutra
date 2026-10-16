"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SiteImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/site-images/upload", { method: "POST", body: formData });
      const body = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!res.ok || !body.key) {
        setError(body.error ?? "Upload failed. Try again.");
        return;
      }
      onChange(body.key);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a public marketing asset, not a static asset next/image can optimize */}
          <img src={`/api/site-images/${value}`} alt="" className="h-16 w-16 rounded-md border object-cover" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      ) : null}
      <Input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFile} disabled={pending} />
      {pending ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
