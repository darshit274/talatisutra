"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = {};

export function ProfileForm({
  initialValues,
}: {
  initialValues: { name: string; designation: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success("Profile updated.");
    }
  }, [state.success]);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={initialValues.name} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input id="designation" name="designation" defaultValue={initialValues.designation} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={initialValues.phone} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
