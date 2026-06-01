import React, { createContext, useContext } from "react";

export interface WorkspacePreferencesValue {
  density: "comfortable" | "compact";
  emailDigest: boolean;
  setDensity: (value: "comfortable" | "compact") => void;
  setEmailDigest: (value: boolean) => void;
}

const WorkspacePreferencesContext = createContext<WorkspacePreferencesValue | null>(null);

export interface WorkspacePreferencesPanelProps {
  density: "comfortable" | "compact";
  emailDigest: boolean;
  onDensityChange: (value: "comfortable" | "compact") => void;
  onEmailDigestChange: (value: boolean) => void;
}

function WorkspacePreferencesConsumer() {
  const preferences = useContext(WorkspacePreferencesContext);

  if (!preferences) {
    return <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">Preferences provider missing.</p>;
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="grid gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Workspace context</span>
        <h2 className="text-lg font-semibold text-slate-900">Preference provider boundary</h2>
      </header>

      <label className="grid gap-2 text-sm text-slate-700" htmlFor="workspace-density">
        <span className="font-medium text-slate-900">Density</span>
        <select
          id="workspace-density"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          value={preferences.density}
          onChange={(event) => preferences.setDensity(event.currentTarget.value as WorkspacePreferencesValue["density"])}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4" htmlFor="workspace-email-digest">
        <input
          id="workspace-email-digest"
          checked={preferences.emailDigest}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          type="checkbox"
          onChange={(event) => preferences.setEmailDigest(event.currentTarget.checked)}
        />
        <span className="grid gap-1">
          <span className="text-sm font-medium text-slate-900">Send digest email</span>
          <span className="text-sm text-slate-600">Provider value flows into this nested consumer control.</span>
        </span>
      </label>
    </section>
  );
}

export function WorkspacePreferencesPanel({
  density,
  emailDigest,
  onDensityChange,
  onEmailDigestChange,
}: WorkspacePreferencesPanelProps) {
  return (
    <WorkspacePreferencesContext.Provider
      value={{ density, emailDigest, setDensity: onDensityChange, setEmailDigest: onEmailDigestChange }}
    >
      <WorkspacePreferencesConsumer />
    </WorkspacePreferencesContext.Provider>
  );
}
