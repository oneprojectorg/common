'use client';

import { Button } from '@op/ui/Button';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { useEffect, useRef } from 'react';
import { LuGripVertical, LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface FieldConfigDropdownProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
}

interface OptionItem {
  id: string;
  value: string;
}

/**
 * Configuration UI for dropdown fields.
 * Allows adding, editing, reordering, and managing dropdown options.
 */
export function FieldConfigDropdown({
  options,
  onOptionsChange,
}: FieldConfigDropdownProps) {
  const t = useTranslations();

  // Use refs to maintain stable IDs across reorders
  const idCounterRef = useRef(0);
  const itemsRef = useRef<OptionItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldFocusNewRef = useRef(false);

  // Sync items with options while preserving stable IDs
  const currentItems = itemsRef.current;
  let optionItems: OptionItem[];

  if (currentItems.length === options.length) {
    // Same length - update values in place, preserving IDs
    optionItems = currentItems.map((item, index) => ({
      id: item.id,
      value: options[index] ?? '',
    }));
  } else if (options.length > currentItems.length) {
    // Items added - keep existing IDs, add new ones for new items
    optionItems = options.map((value, index) => {
      if (index < currentItems.length) {
        return { id: currentItems[index]!.id, value };
      }
      return { id: `option-${idCounterRef.current++}`, value };
    });
  } else {
    // Items removed - rebuild from scratch with new IDs
    // This handles removal correctly since we can't know which was removed
    optionItems = options.map((value) => ({
      id: `option-${idCounterRef.current++}`,
      value,
    }));
  }

  itemsRef.current = optionItems;

  // Focus the last input when a new option is added
  useEffect(() => {
    if (shouldFocusNewRef.current && containerRef.current) {
      const inputs = containerRef.current.querySelectorAll('input[type="text"]');
      const lastInput = inputs[inputs.length - 1] as HTMLInputElement | undefined;
      lastInput?.focus();
      shouldFocusNewRef.current = false;
    }
  }, [options.length]);

  const renderDragPreview = (items: OptionItem[]) => {
    const item = items[0];
    if (!item) {
      return null;
    }
    return (
      <div className="flex items-center gap-2">
        <LuGripVertical className="text-neutral-gray3" size={16} />
        <span className="mr-12 grow rounded-lg border border-neutral-gray2 bg-white px-4 py-3 text-neutral-charcoal shadow-lg">
          {item.value || t('Option')}
        </span>
      </div>
    );
  };

  const handleAddOption = () => {
    shouldFocusNewRef.current = true;
    onOptionsChange([...options, '']);
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onOptionsChange(newOptions);
  };

  const handleReorderOptions = (newItems: OptionItem[]) => {
    // Update the ref to match the new order so IDs stay stable
    itemsRef.current = newItems;
    onOptionsChange(newItems.map((item) => item.value));
  };

  const handleRemoveOption = (index: number) => {
    onOptionsChange(options.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const currentOption = options[index] ?? '';
    if (e.key === 'Enter') {
      e.preventDefault();
      // Add new option if this is the last one and has content
      if (index === options.length - 1 && currentOption.trim()) {
        handleAddOption();
      }
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <h4 className="text-sm text-neutral-charcoal">{t('Options')}</h4>

      {/* Sortable options */}
      <Sortable
        items={optionItems}
        onChange={handleReorderOptions}
        dragTrigger="handle"
        getItemLabel={(item) => item.value || t('Option')}
        renderDragPreview={renderDragPreview}
        className="gap-2"
        aria-label={t('Dropdown options')}
      >
        {(item, controls) => {
          const index = optionItems.findIndex((o) => o.id === item.id);
          return (
            <div className="flex items-center gap-2">
              <DragHandle
                {...controls.dragHandleProps}
                aria-label={t('Drag to reorder option')}
                className="text-neutral-gray3 hover:text-neutral-gray4"
              />
              <TextField
                value={item.value}
                onChange={(value) => handleUpdateOption(index, value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                inputProps={{
                  placeholder: t('Option {number}', { number: index + 1 }),
                }}
                className="w-full"
              />
              <Button
                color="ghost"
                size="small"
                aria-label={t('Remove option')}
                onPress={() => handleRemoveOption(index)}
                className="p-2 text-neutral-gray3 hover:text-neutral-charcoal"
              >
                <LuX size={16} />
              </Button>
            </div>
          );
        }}
      </Sortable>

      {/* Add option link */}
      <Button
        color="ghost"
        size="small"
        onPress={handleAddOption}
        className="hover:text-primary-tealDark gap-1 p-0 text-primary-teal"
      >
        <LuPlus size={16} />
        <span>{t('Add option')}</span>
      </Button>
    </div>
  );
}
