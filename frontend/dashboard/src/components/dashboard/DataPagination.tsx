import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
};

function pageNumbers(page: number, totalPages: number) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: (number | "…")[] = [];
  const window = 1;
  const start = Math.max(2, page - window);
  const end = Math.min(totalPages - 1, page + window);

  pages.push(1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}

export function DataPagination({ page, totalPages, total, from, to, onPageChange }: Props) {
  if (total === 0) return null;
  const nums = pageNumbers(page, totalPages);

  return (
    <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        Showing {from}–{to} of {total}
        <span className="hidden sm:inline"> · Page {page} of {totalPages}</span>
      </p>
      <Pagination className="mx-0 w-full justify-center sm:w-auto sm:justify-end">
        <PaginationContent className="flex-wrap justify-center gap-1">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={`h-8 px-2 text-xs sm:px-3 ${page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          {nums.map((n, i) =>
            n === "…" ? (
              <PaginationItem key={`e-${i}`} className="hidden sm:list-item">
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={n}>
                <PaginationLink
                  href="#"
                  isActive={n === page}
                  className="h-8 min-w-8 cursor-pointer px-2 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(n);
                  }}
                >
                  {n}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              className={`h-8 px-2 text-xs sm:px-3 ${page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
