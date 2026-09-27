"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createDepartment, type DepartmentFormState } from "./actions";

const initialState: DepartmentFormState = {};

export function NewDepartmentForm() {
  const [state, formAction, pending] = useActionState(createDepartment, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <label htmlFor="new-department-name" className="text-sm font-medium">
          New department
        </label>
        <Input id="new-department-name" name="name" placeholder="e.g. Marketing" className="w-56" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
