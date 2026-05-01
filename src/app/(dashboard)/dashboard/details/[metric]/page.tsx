import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DashboardDetailsTable } from "@/components/dashboard/dashboard-details-table";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";
import { getDashboardMetricDetails } from "@/lib/server/dashboard-detail-metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ metric: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { metric } = await params;
  const details = await getDashboardMetricDetails(metric);
  return {
    title: details ? `${details.title} Details` : "Dashboard Details",
  };
}

export default async function DashboardMetricDetailsPage({ params }: Props) {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (role === "member") redirect("/profile");

  const { metric } = await params;
  const details = await getDashboardMetricDetails(metric);
  if (!details) notFound();

  return (
    <PageContainer>
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Details" },
          { label: details.title },
        ]}
        backFallbackHref="/"
        title={details.title}
        icon={details.icon}
        description={details.description}
      />

      <DashboardDetailsTable
        columns={details.columns}
        rows={details.rows}
        emptyMessage={details.emptyMessage}
      />
    </PageContainer>
  );
}
