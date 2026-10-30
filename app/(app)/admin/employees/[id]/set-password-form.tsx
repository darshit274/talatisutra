"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setEmployeePassword, type SetPasswordFormState } from "../actions";

const initialState: SetPasswordFormState = {};

export function SetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(
    setEmployeePassword.bind(null, userId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} className="w-56" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Setting…" : "Set password"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-muted-foreground">
          Password updated. They&apos;ll be asked to change it on next login.
        </p>
      ) : null}
    </form>
  );
}
