"use client";

import { useActionState, useState } from "react";
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
import { updateMaterialMetadata, type MaterialFormState } from "./actions";

const initialState: MaterialFormState = {};

export function EditMaterialForm({
  materialId,
  categories,
  departments,
  initialValues,
}: {
  materialId: string;
  categories: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  initialValues: {
    title: string;
    description: string;
    categoryId: string;
    visibility: "ALL" | "DEPARTMENTS";
    departmentIds: string[];
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateMaterialMetadata.bind(null, materialId),
    initialState,
  );
  const [restricted, setRestricted] = useState(initialValues.visibility === "DEPARTMENTS");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    initialValues.departmentIds,
  );

  function toggleDepartment(id: string, checked: boolean) {
    setSelectedDepartments((prev) => (checked ? [...prev, id] : prev.filter((d) => d !== id)));
  }

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={initialValues.title} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initialValues.description}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-trigger">Category</Label>
        <Select name="categoryId" defaultValue={initialValues.categoryId}>
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

      <input type="hidden" name="visibility" value={restricted ? "DEPARTMENTS" : "ALL"} />
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Checkbox id="restrict" checked={restricted} onCheckedChange={setRestricted} />
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
          <p className="text-sm text-muted-foreground">Visible to every employee.</p>
        )}
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
