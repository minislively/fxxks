type TailwindVariantCardProps = {
  variant?: "primary" | "neutral" | "danger";
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  actions: string[];
  onSelect?: () => void;
};

export function TailwindVariantCard({
  variant = "primary",
  size = "md",
  selected = false,
  disabled = false,
  title,
  description,
  actions,
  onSelect,
}: TailwindVariantCardProps) {
  const toneClass = variant === "danger" ? "border-red-500 bg-red-50 text-red-950" : variant === "neutral" ? "border-slate-200 bg-white text-slate-900" : "border-blue-500 bg-blue-50 text-blue-950";
  const sizeClass = size === "lg" ? "p-6 text-lg" : size === "sm" ? "p-3 text-sm" : "p-4 text-base";
  const selectedClass = selected ? "ring-2 ring-blue-500 shadow-lg" : "shadow-sm";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5";

  return (
    <section className={`rounded-xl border transition ${toneClass} ${sizeClass} ${selectedClass} ${disabledClass}`}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm opacity-80">{description}</p>
        </div>
        <button className="rounded-full bg-blue-600 px-3 py-1 text-white disabled:bg-slate-300" disabled={disabled} onClick={onSelect}>
          Select
        </button>
      </header>
      <ul className="mt-4 grid gap-2">
        {actions.map((action) => (
          <li className="rounded-md bg-white/70 px-3 py-2 text-sm" key={action}>
            {action}
          </li>
        ))}
      </ul>
    </section>
  );
}
