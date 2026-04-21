export interface ComboboxItemData {
  value: string;
  label: string;
}

export interface ComboboxProps {
  items: ComboboxItemData[];
  selectedValue?: string;
  query?: string;
}

export interface ComboboxState {
  items: ComboboxItemData[];
  selectedValue: string | null;
  query: string;
}
