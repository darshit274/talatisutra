"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// File upload goes through this route handler via fetch, not a Server Action
// (BUILD-PLAN "Working conventions" — Server Actions have a smaller body-size limit).
export function NewMaterialForm({
  categories,
  departments,
}: {
  categories: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [restricted, setRestricted] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleDepartment(id: string, checked: boolean) {
    setSelectedDepartments((prev) => (checked ? [...prev, id] : prev.filter((d) => d !== id)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
    if (!fileInput?.files?.[0]) {
      setError("Choose a file to upload.");
      return;
    }

    // The hidden visibility input and each checked department checkbox already carry
    // a real name/value (Base UI's Checkbox renders a native hidden input for form
    // participation), so a plain FormData(form) read picks all of this up correctly —
    // no need to also re-append selectedDepartments by hand.
    const formData = new FormData(form);
    formData.set("visibility", restricted ? "DEPARTMENTS" : "ALL");

    if (restricted && selectedDepartments.length === 0) {
      setError("Pick at least one department, or leave it unrestricted.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      router.push(`/admin/materials/${data.id}`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    // method/action/encType are a fallback only — if a click ever lands before React
    // hydrates and attaches onSubmit, the browser still POSTs correctly to the right
    // endpoint instead of silently GET-reloading this page with the fields as a query
    // string.
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      method="post"
      action="/api/materials/upload"
      encType="multipart/form-data"
      className="max-w-xl space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-trigger">Category</Label>
        <Select name="categoryId" defaultValue="">
          <SelectTrigger id="category-trigger" className="w-full">
            <SelectValue placeholder="No category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No category</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">File (PDF, PNG, JPEG or WebP — max 25 MB)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required />
      </div>

      {/* Static default so a native-fallback submit (JS handler not yet attached) still
          passes validation — the JS handler overwrites this via formData.set() before
          the real fetch. */}
      <input type="hidden" name="visibility" value={restricted ? "DEPARTMENTS" : "ALL"} />
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="restrict"
            checked={restricted}
            onCheckedChange={(checked) => setRestricted(checked)}
          />
          <Label htmlFor="restrict">Restrict to specific departments</Label>
        </div>

        {restricted ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <div key={department.id} className="flex items-center gap-2">
                <Checkbox
                  id={`dept-${department.id}`}
                  name="departmentIds"
                  value={department.id}
                  checked={selectedDepartments.includes(department.id)}
                  onCheckedChange={(checked) => toggleDepartment(department.id, checked)}
                />
                <Label htmlFor={`dept-${department.id}`}>{department.name}</Label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Visible to every signed-in user, including self-registered accounts.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
