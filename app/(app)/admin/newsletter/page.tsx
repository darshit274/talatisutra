import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getNewsletterSubscribers } from "@/lib/queries/newsletter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Newsletter",
};

export default async function AdminNewsletterPage() {
  await requireAdmin("/admin/newsletter");
  const subscribers = await getNewsletterSubscribers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Newsletter</h1>
        <p className="text-sm text-muted-foreground">
          {subscribers.length} subscriber{subscribers.length === 1 ? "" : "s"}. This is a capture
          list only — no email is sent from this system.
        </p>
      </div>

      {subscribers.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No subscribers yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Subscribed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell className="font-medium">{subscriber.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {subscriber.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
