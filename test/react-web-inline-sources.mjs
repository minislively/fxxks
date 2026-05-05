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
