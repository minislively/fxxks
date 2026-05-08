import React, { useState } from "react";
import { useUserTableQuery } from "./data-fetching-user-table.query";

export interface UserDirectoryTableProps {
  initialSearch?: string;
  title: string;
  onExport: () => void;
}

export function UserDirectoryTable({ initialSearch = "", title, onExport }: UserDirectoryTableProps) {
  const [searchValue, setSearchValue] = useState(initialSearch);
  const { isLoading, rows } = useUserTableQuery(searchValue);

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">Search teammates before routing release notifications.</p>
        </div>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="button" onClick={onExport}>
          Export CSV
        </button>
      </header>

      <form className="grid gap-3">
        <label className="grid gap-2 text-sm text-slate-700" htmlFor="directory-search">
          <span className="font-medium text-slate-900">Search teammates</span>
          <input
            id="directory-search"
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
        </label>
      </form>

      <div className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>{rows.length} teammates</span>
          <span>{isLoading ? "Refreshing rows…" : "Rows ready"}</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-900">{row.name}</span>
              <span className="text-xs uppercase tracking-wide text-slate-500">{row.status}</span>
            </div>
            <span className="text-sm text-slate-600">{row.email}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
