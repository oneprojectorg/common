'use client';

import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { DragHandle, Sortable } from '@op/sense/Sortable';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
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
  onUpdateJsonSchema,
}: FieldConfigProps) {
  const handleOptionsChange = (newOptions: FieldOption[]) => {
    const oneOfValues = newOptions.map((o) => ({
      const: o.value,
      title: o.value,
    }));
    onUpdateJsonSchema({ oneOf: oneOfValues });
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
        <span className="me-12 grow rounded-lg border border-neutral-gray2 bg-white px-4 py-3 text-neutral-charcoal shadow-lg">
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
      <h4 className="text-strong">{t('Options')}</h4>

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
              />
              <Input
                value={option.value}
                onChange={(e) => handleUpdateOption(option.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, option)}
                placeholder={t('Option {number}', { number: index + 1 })}
                className="w-full [unicode-bidi:plaintext]"
              />
              <Tooltip disabled={options.length > 2}>
                <TooltipTrigger
                  render={
                    // aria-disabled (not the `disabled` attr) so the button
                    // still receives hover/focus — a disabled <button> eats
                    // pointer events, so the tooltip explaining WHY would never
                    // fire. The onClick guard keeps it inert when blocked.
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('Remove option')}
                      aria-disabled={options.length <= 2 || undefined}
                      className={cn(
                        options.length <= 2 &&
                          'cursor-not-allowed opacity-50 hover:bg-transparent',
                      )}
                      onClick={() => {
                        if (options.length > 2) {
                          handleRemoveOption(option.id);
                        }
                      }}
                    >
                      <LuX className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  {t('At least two options are required')}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        }}
      </Sortable>

      <Button variant="ghost" onClick={handleAddOption}>
        <LuPlus className="size-4" />
        <span>{t('Add option')}</span>
      </Button>
    </div>
  );
}
