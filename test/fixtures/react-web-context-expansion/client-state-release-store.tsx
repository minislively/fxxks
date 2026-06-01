import React from "react";
import { create } from "zustand";

interface ReleaseStoreState {
  selectedReleaseId: string;
  showBlockedOnly: boolean;
  selectRelease: (releaseId: string) => void;
  toggleBlockedOnly: () => void;
}

const useReleaseStore = create<ReleaseStoreState>((set) => ({
  selectedReleaseId: "release-2026-06",
  showBlockedOnly: false,
  selectRelease: (selectedReleaseId) => set({ selectedReleaseId }),
  toggleBlockedOnly: () => set((state) => ({ showBlockedOnly: !state.showBlockedOnly })),
}));

export interface ReleaseOption {
  id: string;
  label: string;
  blocked: boolean;
}

export interface ReleaseStorePanelProps {
  releases: ReleaseOption[];
}

export function ReleaseStorePanel({ releases }: ReleaseStorePanelProps) {
  const selectedReleaseId = useReleaseStore((state) => state.selectedReleaseId);
  const showBlockedOnly = useReleaseStore((state) => state.showBlockedOnly);
  const selectRelease = useReleaseStore((state) => state.selectRelease);
  const toggleBlockedOnly = useReleaseStore((state) => state.toggleBlockedOnly);

  const visibleReleases = showBlockedOnly ? releases.filter((release) => release.blocked) : releases;

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Client state</span>
          <h2 className="text-lg font-semibold text-slate-900">Release store selector</h2>
        </div>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="button" onClick={toggleBlockedOnly}>
          {showBlockedOnly ? "Show all" : "Blocked only"}
        </button>
      </header>

      <ul className="grid gap-2">
        {visibleReleases.map((release) => (
          <li key={release.id}>
            <button
              className={
                release.id === selectedReleaseId
                  ? "flex w-full items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left"
                  : "flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left"
              }
              type="button"
              onClick={() => selectRelease(release.id)}
            >
              <span className="text-sm font-medium text-slate-900">{release.label}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{release.blocked ? "blocked" : "ready"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
