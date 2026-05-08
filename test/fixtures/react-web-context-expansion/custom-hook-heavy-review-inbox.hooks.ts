import { useMemo, useState } from "react";

export interface ReviewInboxItem {
  id: string;
  title: string;
  owner: string;
  status: "open" | "blocked" | "done";
}

export function useReviewSearchState(initialQuery: string) {
  const [query, setQuery] = useState(initialQuery);
  const hasActiveQuery = useMemo(() => query.trim().length > 0, [query]);
  return { query, setQuery, hasActiveQuery };
}

export function useReviewSegments(items: ReviewInboxItem[], query: string) {
  return useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visibleItems =
      normalizedQuery.length === 0
        ? items
        : items.filter((item) => `${item.title} ${item.owner}`.toLowerCase().includes(normalizedQuery));

    return {
      visibleItems,
      summaryLabel: `${visibleItems.length} reviews`,
    };
  }, [items, query]);
}

export function useSelectedReviewId(items: ReviewInboxItem[]) {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(items[0]?.id ?? null);
  return { selectedReviewId, setSelectedReviewId };
}
