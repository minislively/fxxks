import React, { useMemo, useState } from "react";

export interface FilterableResultRow {
  id: string;
  name: string;
  owner: string;
  status: "ready" | "blocked" | "draft";
}

export interface FilterableResultsTableProps {
  initialRows: FilterableResultRow[];
  onExport: () => void;
  title: string;
}

export function FilterableResultsTable({ initialRows, onExport, title }: FilterableResultsTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FilterableResultRow["status"]>("all");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialRows.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 || `${row.name} ${row.owner}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [initialRows, query, statusFilter]);

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Release watch</span>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="button" onClick={onExport}>
          Export rows
        </button>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-2 text-sm text-slate-700" htmlFor="results-table-query">
          <span className="font-medium text-slate-900">Search rows</span>
          <input
            id="results-table-query"
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>

        <label className="grid gap-2 text-sm text-slate-700" htmlFor="results-table-status">
          <span className="font-medium text-slate-900">Status</span>
          <select
            id="results-table-status"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value as "all" | FilterableResultRow["status"])}
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="blocked">Blocked</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3">{row.owner}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
