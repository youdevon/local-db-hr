"use client";

import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
};

const PAGE_SIZES = [10, 20, 50, 100];

export function PaginationControls({
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationControlsProps) {
  const canPrevious = !disabled && page > 1;
  const canNext = !disabled && page < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className="h-10 rounded-md" disabled={!canPrevious} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button type="button" variant="outline" className="h-10 rounded-md" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
      <div className="text-muted-foreground text-sm">
        Page {page} of {Math.max(1, totalPages)}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Rows per page</span>
        <select
          className="border-input bg-background h-10 rounded-md border px-3"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          disabled={disabled}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
