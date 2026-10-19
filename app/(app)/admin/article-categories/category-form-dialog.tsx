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
import { slugify } from "@/lib/slugify";
import { createArticleCategory, updateArticleCategory, type CategoryFormState } from "./actions";

const initialState: CategoryFormState = {};

type CategoryFields = {
  name: string;
  slug: string;
  shortDescription: string;
  servicesDescription: string;
  tags: string[];
};

type Props =
  | { mode: "create" }
  | ({ mode: "edit"; id: string } & CategoryFields);

const EMPTY: CategoryFields = {
  name: "",
  slug: "",
  shortDescription: "",
  servicesDescription: "",
  tags: [],
};

/**
 * One dialog used for both creating and editing an article category — same
 * fields, same layout, just a different bound action and trigger. Mirrors
 * app/(app)/admin/categories/category-form-dialog.tsx's structure.
 */
export function CategoryFormDialog(props: Props) {
  const initial = props.mode === "edit" ? props : EMPTY;
  const action =
    props.mode === "create" ? createArticleCategory : updateArticleCategory.bind(null, props.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const slugTouched = useRef(props.mode === "edit");
  const formRef = useRef<HTMLFormElement>(null);

  // Close and reset only on a genuine pending->not-pending transition with no
  // error, same guard shape as the Materials category dialog.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
      if (props.mode === "create") {
        formRef.current?.reset();
        setName("");
        setSlug("");
        slugTouched.current = false;
      }
    }
    wasPending.current = pending;
  }, [pending, state.error, props.mode]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched.current) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    slugTouched.current = true;
    setSlug(value);
  }

  const tagDefaults = props.mode === "edit" ? props.tags : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          buttonVariants(
            props.mode === "create" ? { variant: "outline" } : { variant: "ghost", size: "sm" },
          ),
        )}
      >
        {props.mode === "create" ? (
          <>
            <Plus className="size-4" aria-hidden="true" />
            New category
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
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              name="slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="auto from name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-short-description">Short description</Label>
            <Textarea
              id="category-short-description"
              name="shortDescription"
              rows={2}
              defaultValue={initial.shortDescription}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-services-description">Services description</Label>
            <Textarea
              id="category-services-description"
              name="servicesDescription"
              rows={2}
              defaultValue={initial.servicesDescription}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input name="tag1" placeholder="Tag 1" defaultValue={tagDefaults[0] ?? ""} />
              <Input name="tag2" placeholder="Tag 2" defaultValue={tagDefaults[1] ?? ""} />
              <Input name="tag3" placeholder="Tag 3" defaultValue={tagDefaults[2] ?? ""} />
            </div>
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
