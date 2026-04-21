import type { ComboboxItemData } from '../types';

export function filterComboboxItems(items: ComboboxItemData[], query: string): ComboboxItemData[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => item.label.toLowerCase().includes(normalized));
}

export function findSelectedLabel(items: ComboboxItemData[], selectedValue: string | null): string {
  return items.find((item) => item.value === selectedValue)?.label ?? '';
}
