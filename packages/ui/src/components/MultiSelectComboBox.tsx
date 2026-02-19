'use client';

import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  composeRenderProps,
} from 'react-aria-components';
import type { Key, ValidationResult } from 'react-aria-components';

import { Label } from './Field';
import { LoadingSpinner } from './LoadingSpinner';
import { Popover } from './Popover';
import { Tag, TagGroup } from './TagGroup';

export interface Option {
  id: string;
  label: string;
  definition?: string | null;
  isNewValue?: boolean;
  level?: number;
  hasChildren?: boolean;
}

export type MultiSelectComboBoxProps = {
  items: Array<Option>;
  label?: string;
  placeholder?: string;
  isRequired?: boolean;
  value?: Array<Option>;
  onChange?: (value: Array<Option>) => void;
  onInputUpdate?: (value: string) => void;
  errorMessage?: string | ((validation: ValidationResult) => string);
  allowAdditions?: boolean;
  showDefinitions?: boolean;
  disableParentSelection?: boolean;
  enableLocalSearch?: boolean;
  isLoading?: boolean;
};

export const MultiSelectComboBox = ({
  items = [],
  label,
  placeholder,
  isRequired,
  value,
  onChange,
  onInputUpdate,
  errorMessage,
  allowAdditions,
  showDefinitions = false,
  disableParentSelection = true,
  enableLocalSearch = true,
  isLoading = false,
}: MultiSelectComboBoxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Close popover on outside clicks (trigger and portaled popover content)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const isInsideTrigger = triggerRef.current?.contains(target) ?? false;
      const isInsidePopover = popoverRef.current?.contains(target) ?? false;
      if (!isInsideTrigger && !isInsidePopover) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const selectedOptions = value ?? [];
  const setSelectedOptions = onChange ?? (() => {});

  const filteredItems = enableLocalSearch
    ? items.filter(
        (option) =>
          option.label.toLowerCase().includes(inputValue.toLowerCase()) &&
          !selectedOptions.some((item) => item.id === option.id),
      )
    : items.filter(
        (option) => !selectedOptions.some((item) => item.id === option.id),
      );

  const disabledKeys = disableParentSelection
    ? filteredItems.filter((o) => o.hasChildren).map((o) => o.id)
    : [];

  const handleItemSelect = (key: Key) => {
    const option = filteredItems.find((o) => o.id === String(key));
    if (option) {
      setSelectedOptions([...selectedOptions, option]);
    }
    setInputValue('');
    onInputUpdate?.('');
    inputRef.current?.focus();
  };

  const handleTagRemove = (keys: Set<Key>) => {
    const keyArray = [...keys];
    const removingOther = keyArray.some((k) => k === 'other');
    if (removingOther) {
      setSelectedOptions(selectedOptions.filter((item) => !item.isNewValue));
    } else {
      setSelectedOptions(
        selectedOptions.filter((item) => !keyArray.includes(item.id)),
      );
    }
  };

  const addInputAsTag = () => {
    if (!allowAdditions) {
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed && !selectedOptions.some((item) => item.label === trimmed)) {
      setSelectedOptions([...selectedOptions, { id: trimmed, label: trimmed }]);
    }
    setInputValue('');
    onInputUpdate?.('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputUpdate?.(e.target.value);
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setIsOpen(true);
        listboxRef.current?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addInputAsTag();
    } else if (e.key === 'Tab') {
      addInputAsTag();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <Label>
          {label}
          {isRequired && <span className="text-functional-red"> *</span>}
        </Label>
      )}

      <div
        ref={triggerRef}
        className={`flex min-h-10 w-full cursor-pointer items-center rounded-md border bg-white px-3 py-2 text-base ${
          errorMessage
            ? 'border-functional-red'
            : 'border-offWhite hover:border-neutral-gray2'
        }`}
        onClick={() => {
          if (document.activeElement !== inputRef.current) {
            inputRef.current?.focus();
            if (filteredItems.length > 0) {
              setIsOpen(true);
            }
          }
        }}
      >
        <div className="relative flex w-full items-center">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className="ml-1 min-w-[40px] flex-1 border-none bg-transparent pr-7 text-base outline-hidden placeholder:text-neutral-gray4"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => {
              if (filteredItems.length > 0) {
                setIsOpen(true);
              }
            }}
            placeholder={placeholder}
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-neutral-charcoal">
            {isLoading ? (
              <LoadingSpinner className="size-4" color="gray" />
            ) : (
              <Search className="size-4" />
            )}
          </span>
        </div>
      </div>

      {selectedOptions.length > 0 && (
        <TagGroup onRemove={handleTagRemove}>
          {selectedOptions.map((option) => (
            <Tag
              key={option.isNewValue ? 'other' : option.id}
              id={option.isNewValue ? 'other' : option.id}
              textValue={option.label}
            >
              {option.label}
            </Tag>
          ))}
        </TagGroup>
      )}

      {errorMessage && (
        <p className="text-sm text-functional-red">
          {typeof errorMessage === 'function'
            ? errorMessage({
                isInvalid: true,
                validationDetails: {} as ValidityState,
                validationErrors: [],
              })
            : errorMessage}
        </p>
      )}

      <Popover
        triggerRef={triggerRef}
        isOpen={isOpen && filteredItems.length > 0}
        isNonModal
        placement="bottom start"
        className="min-w-(--trigger-width) rounded-md border bg-white shadow-lg"
        style={
          {
            '--trigger-width': `${triggerRef.current?.offsetWidth}px`,
          } as React.CSSProperties
        }
      >
        <div ref={popoverRef}>
          <AriaListBox
            ref={listboxRef}
            id={listboxId}
            aria-label={label ?? 'Options'}
            onAction={handleItemSelect}
            disabledKeys={disabledKeys}
            className="max-h-60 overflow-auto py-1 outline-none"
          >
            {filteredItems.map((option) => {
              const isParent = disableParentSelection && option.hasChildren;

              return (
                <AriaListBoxItem
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                  className={composeRenderProps(
                    '',
                    (_className, renderProps) =>
                      `flex flex-col items-start px-3 py-2 text-base outline-none ${
                        isParent
                          ? 'cursor-default text-sm text-neutral-gray4'
                          : `cursor-pointer hover:bg-neutral-gray1 ${renderProps.isFocused ? 'bg-neutral-gray1' : ''}`
                      }`,
                  )}
                  style={{
                    paddingLeft: `${12 + (option.level ?? 0) * 12}px`,
                  }}
                >
                  <span
                    className={isParent ? 'text-sm text-neutral-gray4' : ''}
                  >
                    {option.label}
                  </span>
                  {showDefinitions && option.definition && !isParent ? (
                    <span className="overflow-hidden text-left text-sm text-wrap text-ellipsis text-neutral-charcoal">
                      {option.definition}
                    </span>
                  ) : null}
                </AriaListBoxItem>
              );
            })}
          </AriaListBox>
        </div>
      </Popover>
    </div>
  );
};
