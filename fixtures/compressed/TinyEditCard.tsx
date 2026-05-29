export type TinyEditCardProps = {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function TinyEditCard({ label, value, error, onChange }: TinyEditCardProps) {
  return (
    <form aria-label={label} className="tiny-edit-card">
      <label htmlFor="tiny-edit-card-value">{label}</label>
      <input
        id="tiny-edit-card-value"
        name="tiny-edit-card-value"
        value={value}
        aria-invalid={error ? "true" : "false"}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
