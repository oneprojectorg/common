'use client';

import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { ListBox } from '@op/ui/ListBox';
import { Popover } from '@op/ui/Popover';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import type { Key } from 'react';
import { Dialog, ListBoxItem } from 'react-aria-components';
import type { Selection } from 'react-aria-components';
import { LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export interface MultiSelectPopoverFieldProps {
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}

/**
 * Presentational pill-trigger popover for a multi-select value (e.g.
 * proposal categories). Shared by the collaborative proposal editor and the
 * template builder preview so both stay visually and behaviorally in sync.
 */
export function MultiSelectPopoverField({
  options,
  selectedValues,
  onSelectionChange,
  placeholder,
}: MultiSelectPopoverFieldProps) {
  const t = useTranslations();

  const selectedKeys = new Set(selectedValues);
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );

  if (options.length === 0) {
    return null;
  }

  const handleSelectionChange = (keys: Selection) => {
    if (keys === 'all') {
      onSelectionChange(options.map((o) => o.value));
      return;
    }
    onSelectionChange(
      options.map((option) => option.value).filter((value) => keys.has(value)),
    );
  };

  const handleTagRemove = (keys: Set<Key>) => {
    onSelectionChange(selectedValues.filter((value) => !keys.has(value)));
  };

  const buttonLabel =
    selectedOptions.length === 0
      ? (placeholder ?? t('Select option'))
      : selectedOptions.length === 1
        ? t('1 category selected')
        : t('{count} categories selected', { count: selectedOptions.length });

  return (
    <div className="flex flex-col gap-1.5">
      <DialogTrigger>
        <Button
          variant="pill"
          color="pill"
          className="w-fit justify-start text-start pressed:bg-primary-tealWhite pressed:text-primary-teal pressed:!shadow-none"
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
