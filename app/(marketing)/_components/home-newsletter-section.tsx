"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeToNewsletter, type NewsletterState } from "../actions";

const initialState: NewsletterState = { subscribed: false };

export function HomeNewsletterSection() {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialState);

  return (
    <section className="bg-[#1c1b1a] text-[#f3f2f2]">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
          Get every new GR and circular the day it is issued.
        </h2>
        <p className="mt-3 text-sm text-[#f3f2f2]/70">
          Leave your email and we will keep you posted — no spam, no selling your address.
        </p>

        {state.subscribed ? (
          <p className="mt-6 text-sm font-medium">Thank you for subscribing.</p>
        ) : (
          <form action={formAction} className="mx-auto mt-6 flex max-w-sm flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
              className="border-[#f3f2f2]/30 bg-transparent text-[#f3f2f2] placeholder:text-[#f3f2f2]/50"
            />
            <Button type="submit" variant="outline-accent" disabled={pending}>
              {pending ? "Subscribing…" : "Subscribe"}
            </Button>
          </form>
        )}
        {state.error ? <p className="mt-3 text-sm text-red-300">{state.error}</p> : null}
      </div>
    </section>
  );
}
