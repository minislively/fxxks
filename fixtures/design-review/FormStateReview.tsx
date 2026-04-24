type FormStateReviewProps = {
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onSubmit?: (email: string, role: string) => void;
};

export function FormStateReview({ loading = false, error = null, disabled = false, onSubmit }: FormStateReviewProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit?.(String(form.get("email") ?? ""), String(form.get("role") ?? "viewer"));
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 p-5 shadow-sm" onSubmit={handleSubmit}>
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input className="rounded-md border px-3 py-2" disabled={disabled || loading} name="email" required type="email" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Role
        <select className="rounded-md border px-3 py-2" disabled={disabled || loading} name="role" defaultValue="viewer">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Notes
        <textarea className="min-h-20 rounded-md border px-3 py-2" disabled={disabled || loading} name="notes" />
      </label>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <footer className="flex items-center justify-end gap-3">
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:bg-slate-300" disabled={disabled || loading} type="submit">
          {loading ? "Saving..." : "Save"}
        </button>
      </footer>
    </form>
  );
}
