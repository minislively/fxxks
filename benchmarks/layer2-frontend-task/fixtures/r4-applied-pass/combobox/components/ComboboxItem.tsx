import type { ComboboxItemData } from '../types';

export interface ComboboxItemProps {
  item: ComboboxItemData;
  selected: boolean;
}

export function ComboboxItem({ item, selected }: ComboboxItemProps): string {
  return `${selected ? '*' : '-'} ${item.label}`;
}
