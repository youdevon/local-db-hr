"use client";

/* TanStack Table returns unstable function references; React Compiler skips memoization. */
/* eslint-disable react-hooks/incompatible-library -- useReactTable is the supported API */

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  empty?: React.ReactNode;
  className?: string;
  /** When set, rows are clickable (pointer, hover, Enter/Space). */
  onRowClick?: (row: TData) => void;
  /** Initial sort (e.g. newest first). Third click on a column clears sort and restores data order. */
  initialSorting?: SortingState;
  /** Set false for read-only tables (all columns must set enableSorting: false or use non-sorting headers). */
  enableSorting?: boolean;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  empty,
  className,
  onRowClick,
  initialSorting = [],
  enableSorting = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(() => initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting,
    enableSortingRemoval: true,
    sortDescFirst: false,
  });

  if (!data.length && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        "border-border bg-card overflow-hidden rounded-xl border text-sm shadow-sm",
        className,
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const ariaSort =
                  sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
                return (
                  <TableHead key={header.id} className="whitespace-nowrap" aria-sort={ariaSort}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "hover:bg-muted/40",
                  onRowClick &&
                    "cursor-pointer hover:bg-muted/55 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row.original);
                        }
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
