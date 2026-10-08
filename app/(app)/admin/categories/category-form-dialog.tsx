"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createCategory, updateCategory, type CategoryFormState } from "./actions";

const initialState: CategoryFormState = {};

type Props =
  | { mode: "create"; parentId: string | null; triggerLabel: string }
  | { mode: "edit"; id: string; name: string; description: string | null };

/**
 * One dialog used for both creating a category (bound to `createCategory` with a
 * fixed `parentId`) and editing an existing one's name/description (bound to
 * `updateCategory`) — same fields, same layout, just a different bound action and
 * trigger.
 */
export function CategoryFormDialog(props: Props) {
  const action =
    props.mode === "create"
      ? createCategory.bind(null, props.parentId)
      : updateCategory.bind(null, props.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Close and reset only on a genuine pending->not-pending transition with no
  // error (i.e. right after a real submit succeeds) — checking `!pending &&
  // !state.error` alone would also fire the instant the dialog opens, since
  // that's the initial, pre-submit state too.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          buttonVariants(
            props.mode === "create"
              ? { variant: "outline" }
              : { variant: "ghost", size: "sm" },
          ),
        )}
      >
        {props.mode === "create" ? (
          <>
            <Plus className="size-4" aria-hidden="true" />
            {props.triggerLabel}
          </>
        ) : (
          <>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "New category" : "Edit category"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              name="name"
              defaultValue={props.mode === "edit" ? props.name : ""}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description (optional)</Label>
            <Textarea
              id="category-description"
              name="description"
              rows={3}
              defaultValue={props.mode === "edit" ? (props.description ?? "") : ""}
            />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : props.mode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
