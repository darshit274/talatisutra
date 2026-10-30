"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { SiteImageUploadField } from "./site-image-upload-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ArticleCategory } from "@prisma/client";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
  SliderBlockData,
} from "@/lib/validation/content";

/**
 * Controlled English+Gujarati input pair, for the JSON-backed block editors
 * below (unlike components/admin/bilingual-input.tsx's uncontrolled,
 * name-attribute version used by the other admin forms — this data never
 * has its own form field names, it's assembled into one `data` JSON blob).
 */
function BilingualField({
  label,
  idBase,
  enValue,
  guValue,
  onEnChange,
  onGuChange,
  required,
}: {
  label: string;
  idBase: string;
  enValue: string;
  guValue: string;
  onEnChange: (v: string) => void;
  onGuChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={idBase}>{label}</Label>
      <Input id={idBase} value={enValue} onChange={(e) => onEnChange(e.target.value)} required={required} />
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-gu`} className="text-xs font-normal text-muted-foreground">
          {label} — Gujarati (optional, falls back to English)
        </Label>
        <Input
          id={`${idBase}-gu`}
          value={guValue}
          onChange={(e) => onGuChange(e.target.value)}
          className='font-["Noto_Serif_Gujarati"]'
        />
      </div>
    </div>
  );
}

/** Textarea counterpart to BilingualField above. */
function BilingualTextareaField({
  label,
  idBase,
  enValue,
  guValue,
  onEnChange,
  onGuChange,
  rows = 2,
  required,
}: {
  label: string;
  idBase: string;
  enValue: string;
  guValue: string;
  onEnChange: (v: string) => void;
  onGuChange: (v: string) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={idBase}>{label}</Label>
      <Textarea id={idBase} rows={rows} value={enValue} onChange={(e) => onEnChange(e.target.value)} required={required} />
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-gu`} className="text-xs font-normal text-muted-foreground">
          {label} — Gujarati (optional, falls back to English)
        </Label>
        <Textarea
          id={`${idBase}-gu`}
          rows={rows}
          value={guValue}
          onChange={(e) => onGuChange(e.target.value)}
          className='font-["Noto_Serif_Gujarati"]'
        />
      </div>
    </div>
  );
}

export function HeroFields({ value, onChange }: { value: HeroBlockData; onChange: (v: HeroBlockData) => void }) {
  function updateButton(i: number, field: "label" | "labelGu" | "href", v: string) {
    const buttons = value.buttons.map((b, idx) => (idx === i ? { ...b, [field]: v } : b));
    onChange({ ...value, buttons });
  }

  return (
    <div className="space-y-4">
      <BilingualField
        label="Heading"
        idBase="hero-heading"
        enValue={value.heading}
        guValue={value.headingGu}
        onEnChange={(v) => onChange({ ...value, heading: v })}
        onGuChange={(v) => onChange({ ...value, headingGu: v })}
        required
      />
      <BilingualTextareaField
        label="Subtext"
        idBase="hero-subtext"
        enValue={value.subtext}
        guValue={value.subtextGu}
        onEnChange={(v) => onChange({ ...value, subtext: v })}
        onGuChange={(v) => onChange({ ...value, subtextGu: v })}
      />
      <div className="space-y-2">
        <Label>Buttons</Label>
        {value.buttons.map((button, i) => (
          <div key={i} className="space-y-1 rounded-lg border p-2">
            <div className="flex gap-2">
              <Input placeholder="Label" value={button.label} onChange={(e) => updateButton(i, "label", e.target.value)} />
              <Input placeholder="Link (e.g. /contact)" value={button.href} onChange={(e) => updateButton(i, "href", e.target.value)} />
            </div>
            <Input
              placeholder="Label — Gujarati (optional)"
              value={button.labelGu}
              onChange={(e) => updateButton(i, "labelGu", e.target.value)}
              className='font-["Noto_Serif_Gujarati"]'
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, buttons: value.buttons.filter((_, idx) => idx !== i) })}>
              <X className="size-4" aria-hidden="true" />
              Remove button
            </Button>
          </div>
        ))}
        {value.buttons.length < 4 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, buttons: [...value.buttons, { label: "", labelGu: "", href: "" }] })}>
            <Plus className="size-4" aria-hidden="true" />
            Add button
          </Button>
        ) : null}
      </div>
      <SiteImageUploadField label="Image (optional)" value={value.imageKey} onChange={(imageKey) => onChange({ ...value, imageKey })} />
    </div>
  );
}

export function TextFields({ value, onChange }: { value: TextBlockData; onChange: (v: TextBlockData) => void }) {
  return (
    <div className="space-y-4">
      <BilingualField
        label="Heading (optional)"
        idBase="text-heading"
        enValue={value.heading ?? ""}
        guValue={value.headingGu}
        onEnChange={(v) => onChange({ ...value, heading: v || null })}
        onGuChange={(v) => onChange({ ...value, headingGu: v })}
      />
      <div className="space-y-2">
        <BilingualTextareaField
          label="Body"
          idBase="text-body"
          rows={8}
          enValue={value.body}
          guValue={value.bodyGu}
          onEnChange={(v) => onChange({ ...value, body: v })}
          onGuChange={(v) => onChange({ ...value, bodyGu: v })}
          required
        />
        <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs.</p>
      </div>
    </div>
  );
}

export function CardGridFields({ value, onChange }: { value: CardGridBlockData; onChange: (v: CardGridBlockData) => void }) {
  function updateCard(i: number, patch: Partial<CardGridBlockData["cards"][number]>) {
    onChange({ ...value, cards: value.cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }

  return (
    <div className="space-y-4">
      <BilingualField
        label="Heading (optional)"
        idBase="grid-heading"
        enValue={value.heading ?? ""}
        guValue={value.headingGu}
        onEnChange={(v) => onChange({ ...value, heading: v || null })}
        onGuChange={(v) => onChange({ ...value, headingGu: v })}
      />
      <BilingualTextareaField
        label="Subtext (optional)"
        idBase="grid-subtext"
        enValue={value.subtext ?? ""}
        guValue={value.subtextGu}
        onEnChange={(v) => onChange({ ...value, subtext: v || null })}
        onGuChange={(v) => onChange({ ...value, subtextGu: v })}
      />
      <div className="space-y-3">
        <Label>Cards</Label>
        {value.cards.map((card, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <Input placeholder="Title" value={card.title} onChange={(e) => updateCard(i, { title: e.target.value })} />
            <Input
              placeholder="Title — Gujarati (optional)"
              value={card.titleGu}
              onChange={(e) => updateCard(i, { titleGu: e.target.value })}
              className='font-["Noto_Serif_Gujarati"]'
            />
            <Textarea placeholder="Body" rows={2} value={card.body} onChange={(e) => updateCard(i, { body: e.target.value })} />
            <Textarea
              placeholder="Body — Gujarati (optional)"
              rows={2}
              value={card.bodyGu}
              onChange={(e) => updateCard(i, { bodyGu: e.target.value })}
              className='font-["Noto_Serif_Gujarati"]'
            />
            <SiteImageUploadField label="Image (optional)" value={card.imageKey} onChange={(imageKey) => updateCard(i, { imageKey })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, cards: value.cards.filter((_, idx) => idx !== i) })}>
              <X className="size-4" aria-hidden="true" />
              Remove card
            </Button>
          </div>
        ))}
        {value.cards.length < 12 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...value, cards: [...value.cards, { title: "", titleGu: "", body: "", bodyGu: "", imageKey: null }] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add card
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SliderFields({
  value,
  onChange,
  categories,
}: {
  value: SliderBlockData;
  onChange: (v: SliderBlockData) => void;
  categories: ArticleCategory[];
}) {
  function updateSlide(i: number, patch: Partial<SliderBlockData["slides"][number]>) {
    onChange({ ...value, slides: value.slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }

  function moveSlide(i: number, direction: "up" | "down") {
    const swapWith = direction === "up" ? i - 1 : i + 1;
    if (swapWith < 0 || swapWith >= value.slides.length) return;
    const slides = [...value.slides];
    [slides[i], slides[swapWith]] = [slides[swapWith], slides[i]];
    onChange({ ...value, slides });
  }

  return (
    <div className="space-y-3">
      <Label>Slides</Label>
      {value.slides.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add at least one slide — the slider needs 1 to 5 to save.
        </p>
      ) : null}
      {value.slides.map((slide, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Slide {i + 1}</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => moveSlide(i, "up")} aria-label={`Move slide ${i + 1} up`}>
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={i === value.slides.length - 1}
                onClick={() => moveSlide(i, "down")}
                aria-label={`Move slide ${i + 1} down`}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <BilingualField
            label="Kicker"
            idBase={`slide-${i}-kicker`}
            enValue={slide.kicker}
            guValue={slide.kickerGu}
            onEnChange={(v) => updateSlide(i, { kicker: v })}
            onGuChange={(v) => updateSlide(i, { kickerGu: v })}
            required
          />
          <BilingualField
            label="Title"
            idBase={`slide-${i}-title`}
            enValue={slide.title}
            guValue={slide.titleGu}
            onEnChange={(v) => updateSlide(i, { title: v })}
            onGuChange={(v) => updateSlide(i, { titleGu: v })}
            required
          />
          <BilingualTextareaField
            label="Subtext"
            idBase={`slide-${i}-subtext`}
            enValue={slide.subtext}
            guValue={slide.subtextGu}
            onEnChange={(v) => updateSlide(i, { subtext: v })}
            onGuChange={(v) => updateSlide(i, { subtextGu: v })}
          />
          <BilingualField
            label="CTA label"
            idBase={`slide-${i}-cta`}
            enValue={slide.ctaLabel}
            guValue={slide.ctaLabelGu}
            onEnChange={(v) => updateSlide(i, { ctaLabel: v })}
            onGuChange={(v) => updateSlide(i, { ctaLabelGu: v })}
            required
          />
          <div className="space-y-1">
            <Label htmlFor={`slide-${i}-category-trigger`}>Category</Label>
            <Select value={slide.category} onValueChange={(v) => updateSlide(i, { category: v ?? "" })}>
              <SelectTrigger id={`slide-${i}-category-trigger`} className="w-full">
                <SelectValue placeholder="Choose a category">
                  {(value: string) => categories.find((c) => c.slug === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, slides: value.slides.filter((_, idx) => idx !== i) })}>
            <X className="size-4" aria-hidden="true" />
            Remove slide
          </Button>
        </div>
      ))}
      {value.slides.length < 5 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...value,
              slides: [
                ...value.slides,
                {
                  kicker: "",
                  kickerGu: "",
                  title: "",
                  titleGu: "",
                  subtext: "",
                  subtextGu: "",
                  ctaLabel: "",
                  ctaLabelGu: "",
                  category: categories[0]?.slug ?? "",
                },
              ],
            })
          }
        >
          <Plus className="size-4" aria-hidden="true" />
          Add slide
        </Button>
      ) : null}
    </div>
  );
}

export function CtaBandFields({ value, onChange }: { value: CtaBandBlockData; onChange: (v: CtaBandBlockData) => void }) {
  return (
    <div className="space-y-4">
      <BilingualField
        label="Heading"
        idBase="cta-heading"
        enValue={value.heading}
        guValue={value.headingGu}
        onEnChange={(v) => onChange({ ...value, heading: v })}
        onGuChange={(v) => onChange({ ...value, headingGu: v })}
        required
      />
      <BilingualTextareaField
        label="Subtext"
        idBase="cta-subtext"
        enValue={value.subtext}
        guValue={value.subtextGu}
        onEnChange={(v) => onChange({ ...value, subtext: v })}
        onGuChange={(v) => onChange({ ...value, subtextGu: v })}
      />
      <div className="space-y-1">
        <div className="flex gap-2">
          <Input placeholder="Button label" value={value.button.label} onChange={(e) => onChange({ ...value, button: { ...value.button, label: e.target.value } })} />
          <Input placeholder="Button link" value={value.button.href} onChange={(e) => onChange({ ...value, button: { ...value.button, href: e.target.value } })} />
        </div>
        <Input
          placeholder="Button label — Gujarati (optional)"
          value={value.button.labelGu}
          onChange={(e) => onChange({ ...value, button: { ...value.button, labelGu: e.target.value } })}
          className='font-["Noto_Serif_Gujarati"]'
        />
      </div>
    </div>
  );
}
