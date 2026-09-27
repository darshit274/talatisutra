import type { Metadata } from "next";
import { requireUserForPasswordChange } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Change password",
};

export default async function ChangePasswordPage() {
  const user = await requireUserForPasswordChange();

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Change your password</h1>
        <p className="text-sm text-muted-foreground">
          {user.mustChangePassword
            ? "Set a new password before continuing."
            : "Update the password for your account."}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
