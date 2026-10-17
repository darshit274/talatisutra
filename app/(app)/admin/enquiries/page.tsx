import type { Metadata } from "next";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markEnquiryRead } from "./actions";

export const metadata: Metadata = {
  title: "Enquiries",
};

export default async function AdminEnquiriesPage() {
  const enquiries = await prisma.contactEnquiry.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Enquiries</h1>
        <p className="text-sm text-muted-foreground">
          {enquiries.length} submission{enquiries.length === 1 ? "" : "s"} from the contact form
        </p>
      </div>

      {enquiries.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No enquiries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map((enquiry) => (
            <div key={enquiry.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{enquiry.name}</p>
                    {!enquiry.isRead ? <Badge>New</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {enquiry.email}
                    {enquiry.phone ? ` · ${enquiry.phone}` : ""}
                    {enquiry.district ? ` · ${enquiry.district}` : ""}
                  </p>
                  {enquiry.subject ? (
                    <p className="mt-1 text-sm font-medium">{enquiry.subject}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(enquiry.createdAt, "d MMM yyyy, HH:mm")}
                  </span>
                  <form action={markEnquiryRead.bind(null, enquiry.id, !enquiry.isRead)}>
                    <Button type="submit" variant="outline" size="sm">
                      {enquiry.isRead ? "Mark unread" : "Mark read"}
                    </Button>
                  </form>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {enquiry.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
