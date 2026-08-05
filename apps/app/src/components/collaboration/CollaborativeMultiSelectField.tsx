'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { parseCategoryFragmentValue } from '@op/common/client';
import { Checkbox } from '@op/sense/Checkbox';
import { useEffect, useId, useMemo, useRef } from 'react';

import { LabeledFieldSet } from '@/components/decisions/forms/LabeledFieldSet';
import { OptionBox } from '@/components/decisions/forms/OptionBox';

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
  /** Visible group legend. */
  title: string;
  description?: string;
  required?: boolean;
  /**
   * Renders every chip non-interactive while keeping the legend, options, and
   * current selections visible.
   */
  readOnly?: boolean;
}

/**
 * Collaborative multi-select field synced through a Yjs fragment, rendered as a
 * row of bordered checkbox chips (Figma "Select a category").
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
  title,
  description,
  required,
  readOnly = false,
}: CollaborativeMultiSelectFieldProps) {
  const { ydoc } = useCollaborativeDoc();
  const idPrefix = useId();
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

  if (options.length === 0) {
    return null;
  }

  const handleToggle = (value: string, checked: boolean) => {
    const next = new Set(selectedValues);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }

    // Normalize to the option order so the synced array stays stable no matter
    // which order the chips were ticked in.
    setSyncedValue(
      JSON.stringify(
        options
          .filter((option) => next.has(option.value))
          .map((option) => option.value),
      ),
    );
  };

  return (
    <LabeledFieldSet
      legend={title}
      description={description}
      required={required}
      data-testid={`field-${fragmentName}`}
    >
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const optionId = `${idPrefix}-${option.value}`;
          return (
            <OptionBox
              key={option.value}
              htmlFor={optionId}
              width="hug"
              label={option.label}
              control={
                <Checkbox
                  id={optionId}
                  readOnly={readOnly}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) =>
                    handleToggle(option.value, checked === true)
                  }
                />
              }
            />
          );
        })}
      </div>
    </LabeledFieldSet>
  );
}
