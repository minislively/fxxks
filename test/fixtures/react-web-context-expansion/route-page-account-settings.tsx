import React from "react";

export interface AccountSettingsPageProps {
  displayName: string;
  timezone: string;
  bio: string;
  isSaving?: boolean;
  onDisplayNameChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AccountSettingsPage({
  displayName,
  timezone,
  bio,
  isSaving = false,
  onDisplayNameChange,
  onTimezoneChange,
  onBioChange,
  onCancel,
  onSave,
}: AccountSettingsPageProps) {
  const canSave = displayName.trim().length > 0 && timezone.trim().length > 0 && !isSaving;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8">
      <header className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-600">Settings</span>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold text-slate-900">Account profile</h1>
          <p className="text-sm text-slate-600">Update the information collaborators see across your workspace.</p>
        </div>
      </header>

      <form className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700" htmlFor="account-display-name">
            <span className="font-medium text-slate-900">Display name</span>
            <input
              id="account-display-name"
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.currentTarget.value)}
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-700" htmlFor="account-timezone">
            <span className="font-medium text-slate-900">Timezone</span>
            <select
              id="account-timezone"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={timezone}
              onChange={(event) => onTimezoneChange(event.currentTarget.value)}
            >
              <option value="Asia/Seoul">Asia/Seoul</option>
              <option value="UTC">UTC</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm text-slate-700" htmlFor="account-bio">
          <span className="font-medium text-slate-900">Bio</span>
          <textarea
            id="account-bio"
            className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={bio}
            onChange={(event) => onBioChange(event.currentTarget.value)}
          />
        </label>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">Profile edits sync to workspace comments and activity history.</p>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={!canSave}
              onClick={onSave}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
