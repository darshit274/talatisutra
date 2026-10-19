"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { SiteImageUploadField } from "./site-image-upload-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/articles/categories";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
  SliderBlockData,
} from "@/lib/validation/content";

export function HeroFields({ value, onChange }: { value: HeroBlockData; onChange: (v: HeroBlockData) => void }) {
  function updateButton(i: number, field: "label" | "href", v: string) {
    const buttons = value.buttons.map((b, idx) => (idx === i ? { ...b, [field]: v } : b));
    onChange({ ...value, buttons });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hero-heading">Heading</Label>
        <Input id="hero-heading" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hero-subtext">Subtext</Label>
        <Textarea id="hero-subtext" rows={2} value={value.subtext} onChange={(e) => onChange({ ...value, subtext: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Buttons</Label>
        {value.buttons.map((button, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Label" value={button.label} onChange={(e) => updateButton(i, "label", e.target.value)} />
            <Input placeholder="Link (e.g. /contact)" value={button.href} onChange={(e) => updateButton(i, "href", e.target.value)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, buttons: value.buttons.filter((_, idx) => idx !== i) })}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        {value.buttons.length < 4 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, buttons: [...value.buttons, { label: "", href: "" }] })}>
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
      <div className="space-y-2">
        <Label htmlFor="text-heading">Heading (optional)</Label>
        <Input id="text-heading" value={value.heading ?? ""} onChange={(e) => onChange({ ...value, heading: e.target.value || null })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="text-body">Body</Label>
        <Textarea id="text-body" rows={8} value={value.body} onChange={(e) => onChange({ ...value, body: e.target.value })} required />
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
      <div className="space-y-2">
        <Label htmlFor="grid-heading">Heading (optional)</Label>
        <Input id="grid-heading" value={value.heading ?? ""} onChange={(e) => onChange({ ...value, heading: e.target.value || null })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grid-subtext">Subtext (optional)</Label>
        <Textarea id="grid-subtext" rows={2} value={value.subtext ?? ""} onChange={(e) => onChange({ ...value, subtext: e.target.value || null })} />
      </div>
      <div className="space-y-3">
        <Label>Cards</Label>
        {value.cards.map((card, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <Input placeholder="Title" value={card.title} onChange={(e) => updateCard(i, { title: e.target.value })} />
            <Textarea placeholder="Body" rows={2} value={card.body} onChange={(e) => updateCard(i, { body: e.target.value })} />
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
            onClick={() => onChange({ ...value, cards: [...value.cards, { title: "", body: "", imageKey: null }] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add card
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SliderFields({ value, onChange }: { value: SliderBlockData; onChange: (v: SliderBlockData) => void }) {
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
          <div className="space-y-1">
            <Label htmlFor={`slide-${i}-kicker`}>Kicker</Label>
            <Input id={`slide-${i}-kicker`} value={slide.kicker} onChange={(e) => updateSlide(i, { kicker: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`slide-${i}-title`}>Title</Label>
            <Input id={`slide-${i}-title`} value={slide.title} onChange={(e) => updateSlide(i, { title: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`slide-${i}-subtext`}>Subtext</Label>
            <Textarea id={`slide-${i}-subtext`} rows={2} value={slide.subtext} onChange={(e) => updateSlide(i, { subtext: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`slide-${i}-cta`}>CTA label</Label>
            <Input id={`slide-${i}-cta`} value={slide.ctaLabel} onChange={(e) => updateSlide(i, { ctaLabel: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`slide-${i}-category-trigger`}>Category</Label>
            <Select value={slide.category} onValueChange={(v) => updateSlide(i, { category: v as SliderBlockData["slides"][number]["category"] })}>
              <SelectTrigger id={`slide-${i}-category-trigger`} className="w-full">
                <SelectValue placeholder="Choose a category">
                  {(value: SliderBlockData["slides"][number]["category"]) => CATEGORY_META[value].label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_META[c].label}
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
                { kicker: "", title: "", subtext: "", ctaLabel: "", category: CATEGORY_ORDER[0] },
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
      <div className="space-y-2">
        <Label htmlFor="cta-heading">Heading</Label>
        <Input id="cta-heading" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cta-subtext">Subtext</Label>
        <Textarea id="cta-subtext" rows={2} value={value.subtext} onChange={(e) => onChange({ ...value, subtext: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Input placeholder="Button label" value={value.button.label} onChange={(e) => onChange({ ...value, button: { ...value.button, label: e.target.value } })} />
        <Input placeholder="Button link" value={value.button.href} onChange={(e) => onChange({ ...value, button: { ...value.button, href: e.target.value } })} />
      </div>
    </div>
  );
}
