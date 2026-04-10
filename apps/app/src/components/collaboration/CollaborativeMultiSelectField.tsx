'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { parseCategoryFragmentValue } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const selectedOptions = useMemo(
    () =>
      options
        .filter((option) => selectedValues.includes(option.value))
        .map((option) => ({ id: option.value, label: option.label })),
    [options, selectedValues],
  );

  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef(JSON.stringify(selectedValues));
  const fieldRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

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

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!fieldRef.current?.contains(target)) {
        setIsEditing(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isEditing]);

  const handleSelectedOptionsChange = (
    value: Array<{ id: string; label: string }>,
  ) => {
    const nextValues = value.map((option) => option.id);
    setSyncedValue(JSON.stringify(nextValues));
  };

  const buttonLabel =
    selectedOptions.length === 0
      ? (placeholder ?? t('Select option'))
      : selectedOptions.length === 1
        ? t('1 category selected')
        : t('{count} categories selected', { count: selectedOptions.length });

  if (options.length === 0) {
    return null;
  }

  return (
    <div ref={fieldRef} className="flex flex-col gap-1.5">
      {isEditing ? (
        <div className="w-full max-w-md">
          <MultiSelectComboBox
            items={options.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
            value={selectedOptions}
            onChange={handleSelectedOptionsChange}
            placeholder={t('Search')}
          />
        </div>
      ) : (
        <>
          <Button
            variant="pill"
            color="pill"
            className="justify-start text-left"
            onPress={() => setIsEditing(true)}
          >
            {buttonLabel}
          </Button>
          {selectedOptions.length > 0 && (
            <TagGroup
              onRemove={(keys) => {
                handleSelectedOptionsChange(
                  selectedOptions.filter((option) => !keys.has(option.id)),
                );
              }}
            >
              {selectedOptions.map((option) => (
                <Tag
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                  className="text-base leading-none"
                >
                  {option.label}
                </Tag>
              ))}
            </TagGroup>
          )}
        </>
      )}
    </div>
  );
}
