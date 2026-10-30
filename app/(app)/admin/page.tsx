import type { Metadata } from "next";
import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminDashboardSummary } from "@/lib/queries/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCharts } from "./_components/dashboard-charts";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminDashboardPage() {
  const user = await requireAdmin("/admin");
  const summary = await getAdminDashboardSummary();

  const stats = [
    { label: "Users", value: summary.employeeCount },
    { label: "Active users", value: summary.activeEmployeeCount },
    { label: "Materials", value: summary.materialCount },
    { label: "Unread enquiries", value: summary.unreadEnquiryCount },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Admin — {user.name}</h1>
        <p className="text-sm text-muted-foreground">An overview of the portal.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardCharts
        employeesByDepartment={summary.employeesByDepartment}
        materialsByCategory={summary.materialsByCategory}
        activityByDay={summary.activityByDay}
      />

      <div>
        <h2 className="text-lg font-medium">Recent activity</h2>
        {summary.recentAudit.length === 0 ? (
          <div className="mt-4 rounded-lg border p-8 text-center text-sm text-muted-foreground">
            Nothing has happened yet.
          </div>
        ) : (
          <div className="mt-4 divide-y rounded-lg border">
            {summary.recentAudit.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <span className="font-medium">{entry.actorName ?? "Unknown"}</span>{" "}
                  <span className="text-muted-foreground">
                    {entry.action.replace(/\./g, " ").replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {format(entry.createdAt, "d MMM yyyy, HH:mm")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
