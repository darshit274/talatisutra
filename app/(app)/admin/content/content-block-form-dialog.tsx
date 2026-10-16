"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import type { ContentBlockType, SitePage } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createContentBlock, updateContentBlock, type ContentBlockFormState } from "./actions";
import { BLOCK_TYPE_LABEL } from "@/lib/validation/content";
import { HeroFields, TextFields, CardGridFields, CtaBandFields } from "./block-type-fields";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
} from "@/lib/validation/content";

type BlockData = HeroBlockData | TextBlockData | CardGridBlockData | CtaBandBlockData;

const EMPTY_DATA: Record<ContentBlockType, BlockData> = {
  HERO: { heading: "", subtext: "", buttons: [], imageKey: null },
  TEXT: { heading: null, body: "" },
  CARD_GRID: { heading: null, subtext: null, cards: [] },
  CTA_BAND: { heading: "", subtext: "", button: { label: "", href: "" } },
};

type Props =
  | { mode: "create"; page: SitePage }
  | { mode: "edit"; id: string; type: ContentBlockType; data: BlockData };

const initialState: ContentBlockFormState = {};

export function ContentBlockFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContentBlockType | null>(props.mode === "edit" ? props.type : null);
  const [data, setData] = useState<BlockData>(props.mode === "edit" ? props.data : EMPTY_DATA.HERO);

  const action = props.mode === "create" ? createContentBlock.bind(null, props.page) : updateContentBlock.bind(null, props.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  function pickType(next: ContentBlockType) {
    setType(next);
    setData(EMPTY_DATA[next]);
  }

  // Reset the create-mode picker back to "no type chosen" whenever the dialog closes,
  // whether that's a successful submit (above) or the admin cancelling out — either way
  // the next "+ Add block" open should start from the type picker again, not wherever
  // they left off.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && props.mode === "create") {
      setType(null);
      setData(EMPTY_DATA.HERO);
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
            Add block
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
          <DialogTitle>{props.mode === "create" ? "New block" : `Edit ${BLOCK_TYPE_LABEL[props.type]} block`}</DialogTitle>
        </DialogHeader>

        {props.mode === "create" && !type ? (
          <div className="space-y-2">
            <Select onValueChange={(v) => pickType(v as ContentBlockType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a block type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BLOCK_TYPE_LABEL) as ContentBlockType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {BLOCK_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : type ? (
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="data" value={JSON.stringify(data)} />

            {type === "HERO" ? <HeroFields value={data as HeroBlockData} onChange={setData} /> : null}
            {type === "TEXT" ? <TextFields value={data as TextBlockData} onChange={setData} /> : null}
            {type === "CARD_GRID" ? <CardGridFields value={data as CardGridBlockData} onChange={setData} /> : null}
            {type === "CTA_BAND" ? <CtaBandFields value={data as CtaBandBlockData} onChange={setData} /> : null}

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : props.mode === "create" ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
