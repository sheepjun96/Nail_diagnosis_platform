import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

function WorkspacePaginationButton({
  children,
  disabled,
  label,
  onClick,
}) {
  return (
    <button
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-sm border border-transparent bg-transparent text-white/35 transition-colors hover:border-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:border-transparent disabled:hover:text-white/20"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 2) {
    return [1, 2, 3];
  }

  if (currentPage >= totalPages - 1) {
    return [totalPages - 2, totalPages - 1, totalPages];
  }

  return [currentPage - 1, currentPage, currentPage + 1];
}

export function WorkspacePagination({
  currentPage = 1,
  totalPages = 1,
  disabled = false,
  className,
  onPageChange,
}) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeCurrentPage = Math.min(
    safeTotalPages,
    Math.max(1, Number(currentPage) || 1)
  );
  const isAtFirstPage = safeCurrentPage === 1;
  const isAtLastPage = safeCurrentPage === safeTotalPages;
  const visiblePages = getVisiblePages(safeCurrentPage, safeTotalPages);

  function changePage(nextPage) {
    if (disabled || nextPage === safeCurrentPage) {
      return;
    }

    onPageChange?.(nextPage);
  }

  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <WorkspacePaginationButton
        disabled={disabled || isAtFirstPage}
        label="첫 페이지"
        onClick={() => changePage(1)}
      >
        <ChevronsLeft className="size-5" />
      </WorkspacePaginationButton>
      <WorkspacePaginationButton
        disabled={disabled || isAtFirstPage}
        label="이전 페이지"
        onClick={() => changePage(safeCurrentPage - 1)}
      >
        <ChevronLeft className="size-5" />
      </WorkspacePaginationButton>
      {visiblePages.map((pageNumber) => {
        const isCurrentPage = pageNumber === safeCurrentPage;

        return (
          <button
            key={pageNumber}
            aria-current={isCurrentPage ? "page" : undefined}
            className={
              isCurrentPage
                ? "flex h-9 min-w-9 items-center justify-center rounded-md border border-[#1fd5c0] px-3 text-sm font-semibold text-[#1fd5c0]"
                : "flex h-9 min-w-9 items-center justify-center rounded-md border border-transparent px-3 text-sm font-semibold text-white/55 transition-colors hover:border-white/10 hover:text-white disabled:cursor-not-allowed disabled:hover:border-transparent"
            }
            disabled={disabled || isCurrentPage}
            type="button"
            onClick={() => changePage(pageNumber)}
          >
            {pageNumber}
          </button>
        );
      })}
      <WorkspacePaginationButton
        disabled={disabled || isAtLastPage}
        label="다음 페이지"
        onClick={() => changePage(safeCurrentPage + 1)}
      >
        <ChevronRight className="size-5" />
      </WorkspacePaginationButton>
      <WorkspacePaginationButton
        disabled={disabled || isAtLastPage}
        label="마지막 페이지"
        onClick={() => changePage(safeTotalPages)}
      >
        <ChevronsRight className="size-5" />
      </WorkspacePaginationButton>
    </div>
  );
}
