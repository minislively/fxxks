export type Currency = "USD" | "KRW";

export interface FormatOptions {
  currency: Currency;
  minimumFractionDigits?: number;
}

export function formatAmount(value: number, options: FormatOptions): string {
  const fractionDigits = options.minimumFractionDigits ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: options.currency,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

export const DEFAULT_OPTIONS: FormatOptions = {
  currency: "USD",
  minimumFractionDigits: 2,
};
