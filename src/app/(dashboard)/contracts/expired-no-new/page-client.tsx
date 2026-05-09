"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatContractDate } from "@/lib/mock/contracts";
import type { ExpiredContractNoNewRow } from "@/lib/server/hr";
import { FileWarning } from "lucide-react";

function buildColumns(): ColumnDef<ExpiredContractNoNewRow>[] {
  return [
    {
      accessorKey: "contractNumber",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contract #" />,
    },
    {
      accessorKey: "fileNumber",
      header: ({ column }) => <DataTableColumnHeader column={column} title="File #" />,
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="First Name" />,
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Name" />,
    },
    {
      accessorKey: "position",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contract Start Date" />,
      cell: ({ row }) => formatContractDate(row.original.startDate),
    },
    {
      accessorKey: "endDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contract End Date" />,
      cell: ({ row }) => formatContractDate(row.original.endDate),
    },
    {
      accessorKey: "salary",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Salary" />,
    },
    {
      accessorKey: "gratuity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gratuity" />,
    },
    {
      accessorKey: "daysExpired",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Days Expired" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.daysExpired}</span>,
    },
    {
      accessorKey: "statusLabel",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    },
  ];
}

const columns = buildColumns();

export function ExpiredNoNewContractsClient({
  rows,
  canCreateContract,
}: {
  rows: ExpiredContractNoNewRow[];
  canCreateContract: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts", href: "/contracts" },
          { label: "Expired - No New Contract" },
        ]}
        backFallbackHref="/contracts"
        title="Expired Contracts - No New Contract"
        icon="file-warning"
        description="Employees whose most recent contract is expired and have no active or future contract on file."
        actions={
          canCreateContract ? (
            <Link href="/contracts/new" className={buttonVariants()}>
              New Contract
            </Link>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileWarning}
          title="No contracts found."
          description="No employees currently have expired contracts without a new contract."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/contracts/${row.contractId}`)}
          initialSorting={[{ id: "daysExpired", desc: true }]}
        />
      )}
    </div>
  );
}

