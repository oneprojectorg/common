'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { parseCategoryFragmentValue } from '@op/common/client';
import { useEffect, useMemo, useRef } from 'react';

import { MultiSelectPopoverField } from '@/components/form/MultiSelectPopoverField';

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

  return (
    <MultiSelectPopoverField
      options={options}
      selectedValues={selectedValues}
      onSelectionChange={(values) => setSyncedValue(JSON.stringify(values))}
      placeholder={placeholder}
    />
  );
}
