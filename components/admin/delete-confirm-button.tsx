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
 */
export function DeleteConfirmButton({
  action,
  title,
  description,
  triggerLabel = "Delete",
  triggerClassName,
}: {
  action: () => Promise<void>;
  title: string;
  description: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm", className: "text-destructive" }),
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
