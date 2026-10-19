"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import type { Article, ArticleCategory } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createArticle, updateArticle, type ArticleFormState } from "./actions";

const initialState: ArticleFormState = {};

type Props =
  | { mode: "create"; categories: ArticleCategory[] }
  | { mode: "edit"; article: Article & { category: ArticleCategory }; categories: ArticleCategory[] };

// Fire-and-forget: best-effort disk cleanup for a PDF this dialog uploaded but never
// saved (review finding M-4). The route itself refuses to delete a key any Article
// still references, so this can never touch a live download link.
function discardUnsavedPdf(key: string) {
  fetch(`/api/site-documents/${key}`, { method: "DELETE" }).catch(() => {});
}

export function ArticleFormDialog(props: Props) {
  const originalPdfKey = props.mode === "edit" ? props.article.pdfKey : null;
  const [open, setOpen] = useState(false);
  const [pdf, setPdf] = useState<{ key: string | null; label: string | null }>(
    props.mode === "edit" ? { key: props.article.pdfKey, label: props.article.pdfLabel } : { key: null, label: null },
  );
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const action =
    props.mode === "create" ? createArticle : updateArticle.bind(null, props.article.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Closes the dialog once a submit succeeds (no error, no longer pending). Mirrors
  // ContentBlockFormDialog's success-detection shape.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  // This component stays mounted next to its trigger across opens/closes (unlike
  // ContentBlockFormDialog's create mode, which remounts fresh each time), so `pdf`
  // must be reset explicitly on every open — otherwise a PDF attached and then
  // cancelled (or attached while creating one article) leaks into the next open,
  // and two articles can end up sharing one pdfKey.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPdf(
        props.mode === "edit"
          ? { key: props.article.pdfKey, label: props.article.pdfLabel }
          : { key: null, label: null },
      );
      setPdfError(null);
    } else if (pdf.key && pdf.key !== originalPdfKey) {
      // User-driven close (cancel, Escape, outside click) while an uploaded-but-
      // unsaved PDF is sitting there — discard it rather than leaving it orphaned.
      discardUnsavedPdf(pdf.key);
    }
  }

  async function handlePdfFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPdfError(null);
    setPdfPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/site-documents/upload", { method: "POST", body: formData });
      const body = (await res.json().catch(() => ({}))) as { key?: string; label?: string; error?: string };
      if (!res.ok || !body.key) {
        setPdfError(body.error ?? "Upload failed. Try again.");
        return;
      }
      // Replacing an earlier upload from this same session (not the article's saved
      // PDF) — discard the one being replaced.
      if (pdf.key && pdf.key !== originalPdfKey) {
        discardUnsavedPdf(pdf.key);
      }
      setPdf({ key: body.key, label: body.label ?? null });
    } catch {
      setPdfError("Upload failed. Try again.");
    } finally {
      setPdfPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={cn(buttonVariants(props.mode === "create" ? { variant: "outline" } : { variant: "ghost", size: "sm" }))}
      >
        {props.mode === "create" ? (
          <>
            <Plus className="size-4" aria-hidden="true" />
            Add article
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
          <DialogTitle>{props.mode === "create" ? "New article" : "Edit article"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="pdfKey" value={pdf.key ?? ""} />
          <input type="hidden" name="pdfLabel" value={pdf.label ?? ""} />

          <div className="space-y-2">
            <Label htmlFor="category-trigger">Category</Label>
            <Select name="categoryId" defaultValue={props.mode === "edit" ? props.article.categoryId : undefined}>
              <SelectTrigger id="category-trigger" className="w-full">
                <SelectValue placeholder="Choose a category">
                  {(value: string | undefined) =>
                    value ? props.categories.find((c) => c.id === value)?.name : undefined
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {props.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={props.mode === "edit" ? props.article.title : ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              name="excerpt"
              rows={2}
              defaultValue={props.mode === "edit" ? props.article.excerpt : ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              name="body"
              rows={8}
              defaultValue={props.mode === "edit" ? props.article.body : ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>PDF attachment</Label>
            {pdf.key ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{pdf.label ?? pdf.key}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (pdf.key && pdf.key !== originalPdfKey) discardUnsavedPdf(pdf.key);
                    setPdf({ key: null, label: null });
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}
            <Input type="file" accept=".pdf" onChange={handlePdfFile} disabled={pdfPending} />
            {pdfPending ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
            {pdfError ? <p className="text-sm text-destructive">{pdfError}</p> : null}
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || pdfPending}>
              {pending ? "Saving…" : props.mode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
