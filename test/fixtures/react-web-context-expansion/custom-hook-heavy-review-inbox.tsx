import React, { useMemo } from "react";
import {
  type ReviewInboxItem,
  useReviewSearchState,
  useReviewSegments,
  useSelectedReviewId,
} from "./custom-hook-heavy-review-inbox.hooks";

export interface ReviewInboxPanelProps {
  initialItems: ReviewInboxItem[];
  title: string;
}

export function ReviewInboxPanel({ initialItems, title }: ReviewInboxPanelProps) {
  const { query, setQuery, hasActiveQuery } = useReviewSearchState("");
  const { visibleItems, summaryLabel } = useReviewSegments(initialItems, query);
  const { selectedReviewId, setSelectedReviewId } = useSelectedReviewId(visibleItems);

  const selectedItemTitle = useMemo(() => {
    return visibleItems.find((item) => item.id === selectedReviewId)?.title ?? "Pick a review";
  }, [selectedReviewId, visibleItems]);

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Review inbox</span>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <span className="text-sm text-slate-600">{summaryLabel}</span>
      </div>

      <label className="grid gap-2 text-sm text-slate-700" htmlFor="review-inbox-search">
        <span className="font-medium text-slate-900">Search reviews</span>
        <input
          id="review-inbox-search"
          className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        {hasActiveQuery ? `Showing filtered reviews · ${selectedItemTitle}` : `Showing all reviews · ${selectedItemTitle}`}
      </div>

      <ul className="grid gap-2">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <button
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left"
              type="button"
              onClick={() => setSelectedReviewId(item.id)}
            >
              <span className="grid gap-1">
                <span className="text-sm font-medium text-slate-900">{item.title}</span>
                <span className="text-sm text-slate-600">{item.owner}</span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.status}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
