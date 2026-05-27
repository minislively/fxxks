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

export function reactWebFormStateRolesSource() {
  return `import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

type FormStateRolesDraft = { email: string; role: string };
type InlineFormStateRolesFormProps = { initialEmail?: string; disabled?: boolean; onSubmit?: (value: FormStateRolesDraft) => void };

export function InlineFormStateRolesForm({ initialEmail = "", disabled = false, onSubmit }: InlineFormStateRolesFormProps) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormStateRolesDraft>({
    defaultValues: { email: initialEmail, role: "member" },
  });
  const busy = useMemo(() => loading || disabled, [disabled, loading]);
  const submitForm = handleSubmit((value) => {
    setLoading(true);
    onSubmit?.(value);
  });

  return (
    <form onSubmit={submitForm} className="grid gap-3" aria-busy={busy}>
      <label htmlFor="email">Email</label>
      <input id="email" {...register("email")} disabled={busy} aria-invalid={Boolean(errors.email)} />
      {errors.email ? <p role="alert">{errors.email.message}</p> : null}
      <Controller name="role" control={control} render={({ field }) => <input {...field} readOnly />} />
      <button type="submit" disabled={busy}>Save</button>
    </form>
  );
}

/* ${"form state role budget filler ".repeat(620)} */
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

export function reactWebComponentApiSource() {
  return `type StatusBadgeProps = { label: string };
type ComponentApiItem = { id: string; label: string };
type ComponentApiPanelProps = { title: string; items: ComponentApiItem[]; count?: number; loading?: boolean; error?: string };

function StatusBadge({ label }: StatusBadgeProps) {
  return <span className="badge">{label}</span>;
}

export function InlineComponentApiPanel({ title, items, count = 0, loading, error }: ComponentApiPanelProps) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <StatusBadge label={count > 0 ? "active" : "empty"} />
      {loading ? <p>Loading accounts</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <ul>{items.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
      <p>{count} linked accounts</p>
      <button type="button">Refresh</button>
    </section>
  );
}

/* ${"component api budget filler ".repeat(220)} */
`;
}

export function reactWebA11yAnchorSource() {
  return `type ContactA11yFormProps = { email: string; invalid?: boolean; loading?: boolean; error?: string };

export function InlineA11yContactForm({ email, invalid, loading, error }: ContactA11yFormProps) {
  return (
    <form className="grid gap-3" aria-busy={loading}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        value={email}
        readOnly
        required
        aria-invalid={invalid}
        aria-describedby="email-error email-help missing-id"
        aria-labelledby="email-label"
      />
      <span id="email-label">Primary email</span>
      {loading ? <p>Loading contact details</p> : null}
      {error ? <p id="email-error" role="alert">{error}</p> : null}
      <p id="email-help">Use your work email for recovery.</p>
      <button type="button" disabled={loading}>Refresh</button>
    </form>
  );
}

/* ${"a11y anchor budget filler ".repeat(220)} */
`;
}

export function reactWebStylingVariantSource() {
  return `type VariantPanelProps = {
  variant?: "primary" | "secondary";
  size?: "sm" | "lg";
  disabled?: boolean;
  selected?: boolean;
};

export function InlineVariantPanel({ variant = "primary", size = "sm", disabled, selected }: VariantPanelProps) {
  const toneClass = variant === "primary" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900";
  const sizeClass = size === "lg" ? "px-4 py-3" : "px-2 py-1";
  return (
    <section
      data-state={selected ? "selected" : "idle"}
      className={disabled ? "opacity-50 pointer-events-none" : toneClass + " " + sizeClass}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <button variant={variant} size={size} disabled={disabled} className="rounded-md border">
        Save
      </button>
      <p>Styling hints stay source-derived and avoid design-system semantics.</p>
      <p>Conditional className branches remain source facts only.</p>
      <p>Inline style anchors remain local source facts only.</p>
      <p>Variant props are retained without design-system interpretation.</p>
      <p>Extra body copy keeps this fixture in the compact metadata lane.</p>
    </section>
  );
}

/* ${"styling variant budget filler ".repeat(520)} */
`;
}

export function reactWebImportRoleSource() {
  return `import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import FieldShell from "./FieldShell";
import { format } from "date-fns";

type ImportRoleItem = { id: string; label: string };
type ImportRolePanelProps = { email: string; items?: ImportRoleItem[]; loading?: boolean; error?: string };

export function InlineImportRolePanel({ email, items = [], loading, error }: ImportRolePanelProps) {
  const form = useForm();
  const schema = z.object({ email: z.string() });
  return (
    <FieldShell className="grid gap-3 rounded-lg border p-4" data-form={String(Boolean(form))} data-schema={String(Boolean(schema))}>
      <Button type="button" className="inline-flex items-center gap-2">
        <Mail aria-hidden="true" />
        {email}
      </Button>
      <Link href="/settings" className="text-sm underline">Settings</Link>
      {loading ? <p>Loading imports</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <ul>{items.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
      <p className="text-xs text-slate-500">{format(new Date(), "yyyy-MM-dd")}</p>
      <p className="text-xs text-slate-500">Import role hints are source facts only.</p>
      <p className="text-xs text-slate-500">Runtime library behavior is intentionally not inferred.</p>
      <p className="text-xs text-slate-500">Unknown utility imports must stay out of role hints.</p>
      <p className="text-xs text-slate-500">This fixture stays long enough for compact metadata.</p>
      <p className="text-xs text-slate-500">The same source facts should survive repeated-read context.</p>
    </FieldShell>
  );
}

/* ${"import role budget filler ".repeat(640)} */
`;
}
