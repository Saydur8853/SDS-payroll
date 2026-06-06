import { LookupItem } from '../../models/lookup.model';
import { GlassSelectOption } from './glass-select.component';

export function lookupOptions(
  items: LookupItem[],
  placeholder: string,
  addLabel?: string,
  addValue?: string
): GlassSelectOption[] {
  const options: GlassSelectOption[] = [
    { label: placeholder, value: '' },
    ...items.map(item => ({ label: item.name, value: item.name }))
  ];

  if (addLabel && addValue) {
    options.push({ label: addLabel, value: addValue, variant: 'add' });
  }

  return options;
}

export function lookupIdOptions(items: LookupItem[], placeholder: string): GlassSelectOption[] {
  return [
    { label: placeholder, value: '' },
    ...items.map(item => ({ label: item.name, value: item.id }))
  ];
}

export function nullableLookupOptions(items: LookupItem[], placeholder: string): GlassSelectOption[] {
  return [
    { label: placeholder, value: null },
    ...items.map(item => ({ label: item.name, value: item.name }))
  ];
}

export function stringOptions(
  items: string[],
  placeholder: string,
  addLabel?: string,
  addValue?: string
): GlassSelectOption[] {
  const options: GlassSelectOption[] = [
    { label: placeholder, value: '' },
    ...items.map(item => ({ label: item, value: item }))
  ];

  if (addLabel && addValue) {
    options.push({ label: addLabel, value: addValue, variant: 'add' });
  }

  return options;
}

export function nullableStringOptions(items: string[], placeholder: string): GlassSelectOption[] {
  return [
    { label: placeholder, value: null },
    ...items.map(item => ({ label: item, value: item }))
  ];
}

export function numberOptions(items: number[]): GlassSelectOption[] {
  return items.map(item => ({ label: item.toString(), value: item }));
}
