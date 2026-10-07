"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmail, resendOtp, type VerifyEmailState, type ResendState } from "./actions";

const initialVerifyState: VerifyEmailState = {};
const initialResendState: ResendState = {};

export function VerifyEmailForm({ email }: { email: string }) {
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyEmail, initialVerifyState);
  const [resendState, resendAction, resendPending] = useActionState(resendOtp, initialResendState);

  return (
    <div className="space-y-6">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />

        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </div>

        {verifyState.error ? <p className="text-sm text-destructive">{verifyState.error}</p> : null}

        <Button type="submit" className="w-full" disabled={verifyPending}>
          {verifyPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        {resendState.sent ? (
          <p className="text-center text-sm text-muted-foreground">
            A new code has been sent, if that account needs one.
          </p>
        ) : (
          <Button type="submit" variant="ghost" className="w-full" disabled={resendPending}>
            {resendPending ? "Sending…" : "Resend code"}
          </Button>
        )}
        {resendState.error ? (
          <p className="mt-2 text-center text-sm text-destructive">{resendState.error}</p>
        ) : null}
      </form>
    </div>
  );
}
