export interface ComboboxInputProps {
  query: string;
  placeholder?: string;
}

export function ComboboxInput({ query, placeholder = 'Search' }: ComboboxInputProps): string {
  return `${placeholder}: ${query}`;
}
