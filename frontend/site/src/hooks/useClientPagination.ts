"use client";

import { useMemo, useState, useEffect } from "react";

export function useClientPagination<T>(items: T[], pageSize = 9) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    pageSize,
    totalPages,
    totalItems: items.length,
    pageItems,
    hasPagination: items.length > pageSize,
  };
}
