export const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

export type PaginationParams = {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
};

export function parsePaginationParams(
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>,
): PaginationParams {
  const getValue = (key: string): string => {
    if (!searchParams) return "";
    if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? "";
    const raw = searchParams[key];
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  };

  const pageRaw = Number.parseInt(getValue("page"), 10);
  const pageSizeRaw = Number.parseInt(getValue("pageSize"), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : DEFAULT_PAGE;
  const pageSize = ALLOWED_PAGE_SIZES.includes(pageSizeRaw as (typeof ALLOWED_PAGE_SIZES)[number])
    ? pageSizeRaw
    : DEFAULT_PAGE_SIZE;
  return getLimitOffset(page, pageSize);
}

export function getLimitOffset(page: number, pageSize: number): PaginationParams {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_PAGE;
  const safePageSize = ALLOWED_PAGE_SIZES.includes(pageSize as (typeof ALLOWED_PAGE_SIZES)[number])
    ? pageSize
    : DEFAULT_PAGE_SIZE;
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
    limit: safePageSize,
  };
}

export function getPaginationMeta(totalCount: number, page: number, pageSize: number) {
  const safeTotal = Math.max(0, totalCount || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    totalCount: safeTotal,
    page: safePage,
    pageSize,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
}
