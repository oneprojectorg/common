'use client';

import { Button } from '@op/ui/Button';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { useEffect, useRef, useState } from 'react';
import { LuGripVertical, LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { FieldConfigProps } from './fieldRegistry';

interface FieldOption {
  id: string;
  value: string;
}

/**
 * Field config component for dropdown and multiple choice fields.
 * Reads options from field.options (derived from the FieldView).
 */
export function FieldConfigDropdown({
  field,
  fieldSchema,
  onUpdateJsonSchema,
}: FieldConfigProps) {
  const handleOptionsChange = (newOptions: FieldOption[]) => {
    if (fieldSchema.type === 'array') {
      // multiple_choice: enum is on items
      const enumValues = newOptions.map((o) => o.value);
      const items =
        typeof fieldSchema.items === 'object' &&
        !Array.isArray(fieldSchema.items)
          ? fieldSchema.items
          : {};
      onUpdateJsonSchema({
        items: { ...items, enum: enumValues },
      });
    } else {
      const oneOfValues = newOptions.map((o) => ({
        const: o.value,
        title: o.value,
      }));
      onUpdateJsonSchema({ oneOf: oneOfValues });
    }
  };

  return (
    <FieldConfigDropdownOptions
      initialOptions={field.options}
      onOptionsChange={handleOptionsChange}
    />
  );
}

interface FieldConfigDropdownOptionsProps {
  initialOptions: FieldOption[];
  onOptionsChange: (options: FieldOption[]) => void;
}

/**
 * Configuration UI for dropdown/multiple choice options.
 * Manages its own option state with stable IDs for Sortable,
 * initialized from props on mount.
 */
function FieldConfigDropdownOptions({
  initialOptions,
  onOptionsChange,
}: FieldConfigDropdownOptionsProps) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldFocusNewRef = useRef(false);

  const [options, setOptions] = useState<FieldOption[]>(() =>
    initialOptions.map((o) => ({ ...o, id: crypto.randomUUID() })),
  );

  const updateOptions = (next: FieldOption[]) => {
    setOptions(next);
    onOptionsChange(next);
  };

  // Focus the last input when a new option is added
  useEffect(() => {
    if (shouldFocusNewRef.current && containerRef.current) {
      const inputs = containerRef.current.querySelectorAll(
        'input[type="text"]',
      ) as NodeListOf<HTMLInputElement>;
      const lastInput = inputs[inputs.length - 1];
      lastInput?.focus();
      shouldFocusNewRef.current = false;
    }
  }, [options.length]);

  const renderDragPreview = (items: FieldOption[]) => {
    const item = items[0];
    if (!item) {
      return null;
    }
    return (
      <div className="flex items-center gap-2">
        <LuGripVertical className="size-4 text-neutral-gray3" />
        <span className="mr-12 grow rounded-lg border border-neutral-gray2 bg-white px-4 py-3 text-neutral-charcoal shadow-lg">
          {item.value || t('Option')}
        </span>
      </div>
    );
  };

  const handleAddOption = () => {
    shouldFocusNewRef.current = true;
    updateOptions([...options, { id: crypto.randomUUID(), value: '' }]);
  };

  const handleUpdateOption = (id: string, value: string) => {
    updateOptions(
      options.map((opt) => (opt.id === id ? { ...opt, value } : opt)),
    );
  };

  const handleRemoveOption = (id: string) => {
    updateOptions(options.filter((opt) => opt.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent, option: FieldOption) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const isLastOption = options[options.length - 1]?.id === option.id;
      if (isLastOption && option.value.trim()) {
        handleAddOption();
      }
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <h4 className="text-sm text-neutral-charcoal">{t('Options')}</h4>

      <Sortable
        items={options}
        onChange={updateOptions}
        dragTrigger="handle"
        getItemLabel={(item) => item.value || t('Option')}
        renderDragPreview={renderDragPreview}
        className="gap-2"
        aria-label={t('Dropdown options')}
      >
        {(option, controls) => {
          const index = options.findIndex((o) => o.id === option.id);
          return (
            <div className="flex items-center gap-2">
              <DragHandle
                {...controls.dragHandleProps}
                aria-label={t('Drag to reorder option')}
                className="text-neutral-gray3 hover:text-neutral-gray4"
              />
              <TextField
                value={option.value}
                onChange={(value) => handleUpdateOption(option.id, value)}
                onKeyDown={(e) => handleKeyDown(e, option)}
                inputProps={{
                  placeholder: t('Option {number}', { number: index + 1 }),
                }}
                className="w-full"
              />
              <Button
                color="ghost"
                size="small"
                aria-label={t('Remove option')}
                onPress={() => handleRemoveOption(option.id)}
                className="p-2 text-neutral-gray3 hover:text-neutral-charcoal"
              >
                <LuX className="size-4" />
              </Button>
            </div>
          );
        }}
      </Sortable>

      <Button
        color="ghost"
        size="small"
        onPress={handleAddOption}
        className="hover:text-primary-tealDark gap-1 p-0 text-primary-teal"
      >
        <LuPlus className="size-4" />
        <span>{t('Add option')}</span>
      </Button>
    </div>
  );
}
