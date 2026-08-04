'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { parseCategoryFragmentValue } from '@op/common/client';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
import { useEffect, useMemo, useRef } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface CollaborativeMultiSelectFieldProps {
  options: Array<MultiSelectOption>;
  initialValue?: string[];
  onChange?: (value: string[]) => void;
  /** Yjs fragment name used to sync this field. Must be unique per instance. */
  fragmentName: string;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string;
}

/**
 * Collaborative multi-select field synced through a Yjs fragment.
 *
 * Values are serialized as a JSON string array so all connected users see the
 * same category selections in real time while the rest of the app consumes a
 * plain `string[]` API.
 */
export function CollaborativeMultiSelectField({
  options,
  initialValue = [],
  onChange,
  fragmentName,
  placeholder,
}: CollaborativeMultiSelectFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const [syncedValue, setSyncedValue] = useCollaborativeFragment(
    ydoc,
    fragmentName,
    JSON.stringify(initialValue),
  );

  const selectedValues = useMemo(
    () => parseCategoryFragmentValue(syncedValue),
    [syncedValue],
  );
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedValues.includes(option.value)),
    [options, selectedValues],
  );

  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const nextValueKey = JSON.stringify(selectedValues);
    if (lastEmittedValueRef.current === nextValueKey) {
      return;
    }

    lastEmittedValueRef.current = nextValueKey;
    onChangeRef.current?.(selectedValues);
  }, [selectedValues]);

  if (options.length === 0) {
    return null;
  }

  const resolvedPlaceholder = placeholder ?? t('Select option');

  const handleValueChange = (nextOptions: Array<MultiSelectOption>) => {
    // Normalize to the option order so the synced array stays stable no matter
    // which order the chips were added in.
    setSyncedValue(
      JSON.stringify(
        options
          .filter((option) =>
            nextOptions.some((selected) => selected.value === option.value),
          )
          .map((option) => option.value),
      ),
    );
  };

  return (
    <Combobox
      multiple
      items={options}
      value={selectedOptions}
      onValueChange={handleValueChange}
      itemToStringLabel={(option: MultiSelectOption) => option.label}
      isItemEqualToValue={(a: MultiSelectOption, b: MultiSelectOption) =>
        a.value === b.value
      }
    >
      <ComboboxChips className="max-w-full">
        <LuSearch className="size-4 shrink-0 self-center text-muted-foreground" />
        {/* ComboboxChip takes no `value` — the chip↔value link is render order. */}
        {selectedOptions.map((option) => (
          <ComboboxChip key={option.value}>{option.label}</ComboboxChip>
        ))}
        <ComboboxChipsInput
          aria-label={resolvedPlaceholder}
          placeholder={
            selectedOptions.length === 0 ? resolvedPlaceholder : undefined
          }
        />
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>{t('No results')}</ComboboxEmpty>
        <ComboboxList>
          {(item: MultiSelectOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
