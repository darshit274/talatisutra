"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Every destructive admin action goes through this (BUILD-PLAN §9): names the thing
 * being deleted, requires an explicit confirm. `action` is a Server Action (typically
 * pre-bound to the row's id via `.bind(null, id)`) that should `redirect()` when done
 * — that navigation is what actually closes this dialog, since it unmounts the tree.
 *
 * `disabled` renders a plain disabled button instead of the dialog trigger — used
 * when the caller already knows the delete would fail (e.g. a category with
 * children) and wants to say so up front rather than let the user open the dialog
 * and hit a server-side rejection. `disabledReason` becomes the button's native
 * `title` attribute (a hover tooltip) explaining why.
 *
 * `emphasized` swaps the default low-key ghost-text trigger for the design
 * system's tinted `destructive` button variant, for the rare case where a delete
 * button sits alone (not in a dense list row) and needs to read clearly at a
 * glance. Every existing caller omits it and keeps today's subtle look.
 */
export function DeleteConfirmButton({
  action,
  title,
  description,
  triggerLabel = "Delete",
  triggerClassName,
  disabled = false,
  disabledReason,
  emphasized = false,
}: {
  action: () => Promise<void>;
  title: string;
  description: string;
  triggerLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
  disabledReason?: string;
  emphasized?: boolean;
}) {
  const triggerVariant = emphasized ? "destructive" : "ghost";
  const triggerVariantClassName = emphasized ? undefined : "text-destructive";

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className={cn(
          buttonVariants({ variant: triggerVariant, size: "sm", className: triggerVariantClassName }),
          "cursor-not-allowed opacity-50",
          triggerClassName,
        )}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        className={cn(
          buttonVariants({ variant: triggerVariant, size: "sm", className: triggerVariantClassName }),
          triggerClassName,
        )}
      >
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction type="submit" variant="destructive" className="w-full">
              {triggerLabel}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
