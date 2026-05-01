"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ContractResultsTable } from "@/components/contracts/contract-results-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  contractMatchesQuery,
  type ContractListRow,
} from "@/lib/mock/contracts";

export function ContractsClient({ rows: allRows, canCreate }: { rows: ContractListRow[]; canCreate: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [listVisible, setListVisible] = useState(false);
  const [appliedSearch, setAppliedSearch] = useState("");

  function applySearch(nextQuery: string) {
    const normalized = nextQuery.trim();
    setListVisible(true);
    setAppliedSearch(normalized);
    if (process.env.NODE_ENV !== "production") {
      const resultCount = normalized ? allRows.filter((row) => contractMatchesQuery(row, normalized)).length : 0;
      console.log("[contracts/search]", { query: normalized, resultCount });
    }
  }

  const rows = useMemo(() => {
    if (!listVisible) return [];
    if (!appliedSearch.trim()) return [];
    return allRows.filter((row) => contractMatchesQuery(row, appliedSearch));
  }, [listVisible, appliedSearch, allRows]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts" },
        ]}
        title="Contracts"
        icon="file-text"
        description="Search, review, and manage employee contract records."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreate ? <Link href="/contracts/new" className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}>New Contract</Link> : null}
            <Button type="button" variant="secondary" className="h-10 rounded-md text-sm font-medium" onClick={() => router.push("/contracts/directory")}>
              Show All
            </Button>
          </div>
        }
      />

      <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="h-10 rounded-md pl-9 text-sm"
              placeholder="Search by minute #, employee name, file number, contract number, position, department or status"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applySearch(query);
                }
              }}
            />
          </div>
          {query.trim() ? (
            <Button type="button" variant="outline" className="h-10 rounded-md text-sm font-medium" onClick={() => setQuery("")}>
              Clear
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-10 rounded-md text-sm font-medium"
            onClick={() => {
              applySearch(query);
            }}
          >
            Search
          </Button>
        </div>
      </div>

      {!listVisible ? (
        <EmptyState
          icon={FileText}
          title="No contracts found."
          description="Run a search or click Show All to open the contract directory."
        />
      ) : (
        <ContractResultsTable
          contracts={rows}
          onRowClick={(row) => router.push(`/contracts/${row.id}`)}
          emptyTitle="No contracts found."
          emptyDescription="Try adjusting your search terms."
          emptyAction={canCreate ? <Link href="/contracts/new" className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}>New Contract</Link> : null}
        />
      )}
    </div>
  );
}
