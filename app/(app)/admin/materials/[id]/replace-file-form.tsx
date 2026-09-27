"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ReplaceFileForm({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
    if (!fileInput?.files?.[0]) {
      setError("Choose a file.");
      return;
    }

    const formData = new FormData(form);
    setPending(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/replace`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      form.reset();
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <Label htmlFor="replace-file">New file</Label>
        <Input id="replace-file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Uploading…" : "Replace"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-muted-foreground">File replaced.</p> : null}
    </form>
  );
}
