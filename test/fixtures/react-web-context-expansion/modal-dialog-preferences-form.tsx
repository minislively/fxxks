import React, { useMemo } from "react";

export interface PreferencesDialogProps {
  emailUpdates: boolean;
  digestWindow: string;
  errorMessage?: string;
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onEmailUpdatesChange: (checked: boolean) => void;
  onDigestWindowChange: (value: string) => void;
  onSave: () => void;
}

export function PreferencesDialog({
  emailUpdates,
  digestWindow,
  errorMessage,
  isOpen,
  isSaving = false,
  onClose,
  onEmailUpdatesChange,
  onDigestWindowChange,
  onSave,
}: PreferencesDialogProps) {
  const statusLabel = useMemo(() => {
    if (isSaving) return "Saving preferences";
    if (errorMessage) return "Preferences need attention";
    return "Preferences ready to save";
  }, [errorMessage, isSaving]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950/40 px-4">
      <div
        aria-describedby="preferences-dialog-description"
        aria-labelledby="preferences-dialog-title"
        aria-modal="true"
        className="grid w-full max-w-lg gap-5 rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <header className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Workspace preferences</span>
          <h2 id="preferences-dialog-title" className="text-xl font-semibold text-slate-900">
            Update digest notifications
          </h2>
          <p id="preferences-dialog-description" className="text-sm text-slate-600">
            Choose how often the team should summarize unresolved review work.
          </p>
        </header>

        <form className="grid gap-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4" htmlFor="preferences-email-updates">
            <input
              id="preferences-email-updates"
              checked={emailUpdates}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              type="checkbox"
              onChange={(event) => onEmailUpdatesChange(event.currentTarget.checked)}
            />
            <span className="grid gap-1">
              <span className="text-sm font-medium text-slate-900">Email me new review summaries</span>
              <span className="text-sm text-slate-600">Send a short digest when overdue review threads need attention.</span>
            </span>
          </label>

          <label className="grid gap-2 text-sm text-slate-700" htmlFor="preferences-digest-window">
            <span className="font-medium text-slate-900">Digest window</span>
            <select
              id="preferences-digest-window"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              value={digestWindow}
              onChange={(event) => onDigestWindowChange(event.currentTarget.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusLabel}</div>
          {errorMessage ? <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div> : null}
        </form>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isSaving}
            onClick={onSave}
          >
            {isSaving ? "Saving…" : "Save preferences"}
          </button>
        </footer>
      </div>
    </div>
  );
}
