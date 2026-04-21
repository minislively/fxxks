import type { ComboboxProps } from '../types';
import { findSelectedLabel } from '../utils';
import { useCombobox } from '../hooks';
import { ComboboxInput } from './ComboboxInput';
import { ComboboxList } from './ComboboxList';

export function Combobox(props: ComboboxProps): { input: string; selectedLabel: string; rows: string[] } {
  const state = useCombobox(props.items, props.selectedValue, props.query);
  return {
    input: ComboboxInput({ query: state.query }),
    selectedLabel: findSelectedLabel(props.items, state.selectedValue),
    rows: ComboboxList({ items: state.items, selectedValue: state.selectedValue }),
  };
}
