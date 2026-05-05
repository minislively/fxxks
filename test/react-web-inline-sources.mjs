export function reactWebFormStateFlowSource() {
  return `import { useMemo, useState } from "react";

type Props = { onSubmit?: (value: string) => void };

export function InlineRetentionForm({ onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const disabled = loading || email.length === 0;
  const label = useMemo(() => email.trim() || "guest", [email]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    onSubmit?.(label);
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={loading}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} aria-invalid={email.length === 0} />
      <button type="submit" disabled={disabled}>Save</button>
    </form>
  );
}

/* ${"form flow budget filler ".repeat(140)} */
`;
}

export function reactWebLayoutRegionSource() {
  return `type LayoutItem = { id: string; label: string };
type LayoutPanelProps = { items: LayoutItem[]; loading?: boolean; error?: string };

export function InlineLayoutPanel({ items, loading, error }: LayoutPanelProps) {
  return (
    <main className={loading ? "grid gap-4" : "flex flex-col gap-4"}>
      <header><h1>Accounts</h1></header>
      <section>
        {loading && <p>Loading accounts</p>}
        {error ? <p role="alert">{error}</p> : null}
        {items.length === 0 && <p>No accounts yet</p>}
        <ul>{items.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
      </section>
      <form><label htmlFor="filter">Filter</label><input id="filter" name="filter" /></form>
      <footer><button type="button">Refresh</button></footer>
    </main>
  );
}

/* ${"layout budget filler ".repeat(360)} */
`;
}
