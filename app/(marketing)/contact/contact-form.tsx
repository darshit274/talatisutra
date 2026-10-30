"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "cn";
import { submitContactForm, type ContactState } from "./actions";

const initialState: ContactState = { submitted: false };

const DISTRICTS = [
  "Ahmedabad",
  "Banaskantha",
  "Bhavnagar",
  "Kutch",
  "Mehsana",
  "Rajkot",
  "Surat",
  "Vadodara",
  "Other",
];

const SUBJECTS = ["Missing document", "Procedure question", "Exam material", "Other"] as const;

// Visually hidden, not tab-reachable, and out of the accessibility tree — a real
// visitor (including one using a screen reader) never encounters this field. Zero
// width/height + overflow hidden avoids the phantom-scrollbar bug that off-screen
// absolute positioning can cause. Tailwind classes rather than an inline `style`
// attribute, so this keeps working under a strict style-src CSP (§9) with no
// 'unsafe-inline'.
const HONEYPOT_CLASSES =
  "absolute h-px w-px -m-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, initialState);

  if (state.submitted) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">Thanks for reaching out.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ve received your message and will get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className={HONEYPOT_CLASSES} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile number (optional)</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district-trigger">District (optional)</Label>
          <Select name="district">
            <SelectTrigger id="district-trigger" className="w-full">
              <SelectValue placeholder="Choose a district" />
            </SelectTrigger>
            <SelectContent>
              {DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Subject</Label>
        <div className="flex flex-wrap rounded-lg border" role="radiogroup" aria-label="Subject">
          {SUBJECTS.map((subject, i) => (
            <label
              key={subject}
              className={cn(
                "flex-1 cursor-pointer px-3 py-2 text-center text-sm whitespace-nowrap transition-colors has-checked:bg-primary/10 has-checked:text-primary has-checked:font-medium",
                i > 0 && "border-l",
              )}
            >
              <input
                type="radio"
                name="subject"
                value={subject}
                defaultChecked={i === 0}
                className="sr-only"
              />
              {subject}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" rows={6} required />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
