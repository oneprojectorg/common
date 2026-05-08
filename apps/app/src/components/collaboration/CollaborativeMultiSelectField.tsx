'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { parseCategoryFragmentValue } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { ListBox } from '@op/ui/ListBox';
import { Popover } from '@op/ui/Popover';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { useEffect, useMemo, useRef } from 'react';
import type { Key } from 'react';
import { Dialog, ListBoxItem } from 'react-aria-components';
import type { Selection } from 'react-aria-components';
import { LuCheck } from 'react-icons/lu';

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
  const selectedKeys = useMemo(() => new Set(selectedValues), [selectedValues]);
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

  const handleSelectionChange = (keys: Selection) => {
    if (keys === 'all') {
      setSyncedValue(JSON.stringify(options.map((o) => o.value)));
      return;
    }
    const nextValues = options
      .map((option) => option.value)
      .filter((value) => keys.has(value));
    setSyncedValue(JSON.stringify(nextValues));
  };

  const handleTagRemove = (keys: Set<Key>) => {
    setSyncedValue(
      JSON.stringify(selectedValues.filter((value) => !keys.has(value))),
    );
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
    <div className="flex flex-col gap-1.5">
      <DialogTrigger>
        <Button
          variant="pill"
          color="pill"
          className="w-fit justify-start text-left pressed:bg-primary-tealWhite pressed:text-primary-teal pressed:!shadow-none"
        >
          {buttonLabel}
        </Button>
        <Popover
          placement="bottom start"
          className="min-w-(--trigger-width) overflow-hidden rounded border bg-white shadow"
        >
          <Dialog className="outline-hidden">
            <ListBox
              aria-label={placeholder ?? t('Select option')}
              items={options.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              selectionMode="multiple"
              selectedKeys={selectedKeys}
              onSelectionChange={handleSelectionChange}
              className="max-h-60 overflow-auto rounded border-0 p-2 outline-hidden"
            >
              {(item) => (
                <ListBoxItem
                  id={item.id}
                  textValue={item.label}
                  className="group flex cursor-pointer items-center gap-4 rounded px-3 py-2 text-neutral-black outline-hidden select-none data-[focus-visible]:bg-neutral-gray1 data-[hovered]:bg-neutral-gray1"
                >
                  <span className="flex h-full flex-1 items-center gap-2 font-normal">
                    {item.label}
                  </span>
                  <span className="flex w-5 items-center">
                    <LuCheck
                      aria-hidden
                      className="size-4 opacity-0 group-selected:opacity-100"
                    />
                  </span>
                </ListBoxItem>
              )}
            </ListBox>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {selectedOptions.length > 0 && (
        <TagGroup onRemove={handleTagRemove}>
          {selectedOptions.map((option) => (
            <Tag
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="text-base leading-none"
            >
              {option.label}
            </Tag>
          ))}
        </TagGroup>
      )}
    </div>
  );
}
