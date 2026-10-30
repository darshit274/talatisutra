import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const sessionUser = await requireUser("/profile");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: { department: true },
  });

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your contact details. Your email, role and department are managed by an
          administrator.
        </p>
      </div>

      <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{user.role === "ADMIN" ? "Admin" : "User"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Department</dt>
          <dd className="font-medium">{user.department?.name ?? "None"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">User code</dt>
          <dd className="font-medium">{user.employeeCode ?? "None"}</dd>
        </div>
      </dl>

      {/* Keyed on updatedAt so a successful save remounts the form with fresh
          defaultValues instead of mutating an already-initialized uncontrolled Base UI
          input in place (which it warns about). */}
      <ProfileForm
        key={user.updatedAt.toISOString()}
        initialValues={{
          name: user.name,
          designation: user.designation ?? "",
          phone: user.phone ?? "",
        }}
      />

      <Separator />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Password</h2>
        <p className="text-sm text-muted-foreground">
          Change the password you use to sign in.
        </p>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/change-password" />}
        >
          Change password
        </Button>
      </div>
    </div>
  );
}
