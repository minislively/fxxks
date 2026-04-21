import type { ComboboxItemData, ComboboxState } from '../types';
import { filterComboboxItems } from '../utils';

export function useCombobox(items: ComboboxItemData[], selectedValue?: string, query = ''): ComboboxState {
  return {
    items: filterComboboxItems(items, query),
    selectedValue: selectedValue ?? null,
    query,
  };
}
