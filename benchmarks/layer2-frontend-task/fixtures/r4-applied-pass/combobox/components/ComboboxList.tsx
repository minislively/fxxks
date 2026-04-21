import type { ComboboxItemData } from '../types';
import { ComboboxItem } from './ComboboxItem';

export interface ComboboxListProps {
  items: ComboboxItemData[];
  selectedValue: string | null;
}

export function ComboboxList({ items, selectedValue }: ComboboxListProps): string[] {
  return items.map((item) => ComboboxItem({ item, selected: item.value === selectedValue }));
}
