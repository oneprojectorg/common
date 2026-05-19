'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { parseCategoryFragmentValue } from '@op/common/client';
import {
  MultiSelectComboBox,
  type Option,
} from '@op/ui-next/MultiSelectComboBox';
import { useEffect, useMemo, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeMultiSelectFieldProps {
  options: Array<{ value: string; label: string }>;
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

  const items = useMemo<Option[]>(
    () => options.map((o) => ({ id: o.value, label: o.label })),
    [options],
  );

  const selectedOptions = useMemo<Option[]>(
    () =>
      items.filter((option) =>
        selectedValues.includes(String(option.id ?? '')),
      ),
    [items, selectedValues],
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

  const handleChange = (next: Option[]) => {
    setSyncedValue(JSON.stringify(next.map((o) => o.id)));
  };

  if (options.length === 0) {
    return null;
  }

  return (
    <MultiSelectComboBox
      items={items}
      value={selectedOptions}
      onChange={handleChange}
      placeholder={placeholder ?? t('Select option')}
    />
  );
}
