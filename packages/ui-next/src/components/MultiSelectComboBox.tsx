'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

import { FieldLabel } from './Field';
import { LoadingSpinner } from './LoadingSpinner';
import { Tag, TagGroup } from './TagGroup';
import { cn } from '../lib/utils';

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
  errorMessage?: string;
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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

  const selectOption = (option: Option) => {
    setSelectedOptions([...selectedOptions, option]);
    setInputValue('');
    setActiveIndex(-1);
    onInputUpdate?.('');
    inputRef.current?.focus();
  };

  const removeOption = (option: Option) => {
    if (option.isNewValue) {
      setSelectedOptions(selectedOptions.filter((item) => !item.isNewValue));
    } else {
      setSelectedOptions(selectedOptions.filter((item) => item.id !== option.id));
    }
  };

  const addInputAsTag = () => {
    if (!allowAdditions) {
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed && !selectedOptions.some((item) => item.label === trimmed)) {
      setSelectedOptions([
        ...selectedOptions,
        { id: trimmed, label: trimmed, isNewValue: true },
      ]);
    }
    setInputValue('');
    onInputUpdate?.('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputUpdate?.(e.target.value);
    setInputValue(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setIsOpen(true);
        setActiveIndex((i) => Math.min(i + 1, filteredItems.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredItems.length) {
        const option = filteredItems[activeIndex];
        const isParent = disableParentSelection && option?.hasChildren;
        if (option && !isParent) {
          selectOption(option);
        }
      } else {
        addInputAsTag();
      }
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
        <FieldLabel>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}

      <div ref={triggerRef} className="flex flex-col gap-2">
        <div
          className={cn(
            'flex min-h-10 w-full cursor-pointer items-center rounded-lg border bg-background px-3 py-2 text-base',
            errorMessage
              ? 'border-destructive'
              : 'border-input hover:border-foreground/40',
          )}
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
              className="ml-1 min-w-[40px] flex-1 border-none bg-transparent pr-7 text-base outline-none placeholder:text-muted-foreground"
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
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
              {isLoading ? (
                <LoadingSpinner className="size-4" color="gray" />
              ) : (
                <LuSearch className="size-4" />
              )}
            </span>
          </div>
        </div>

        {selectedOptions.length > 0 && (
          <TagGroup>
            {selectedOptions.map((option) => (
              <Tag
                key={option.isNewValue ? 'other' : option.id}
                className="text-base leading-none"
              >
                {option.label}
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  onClick={() => removeOption(option)}
                >
                  <LuX className="size-3" />
                </button>
              </Tag>
            ))}
          </TagGroup>
        )}
      </div>

      {errorMessage && (
        <p className="text-destructive text-sm">{errorMessage}</p>
      )}

      {isOpen && filteredItems.length > 0 && (
        <div className="relative">
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            aria-label={label ?? 'Options'}
            className="bg-popover text-popover-foreground ring-foreground/10 absolute top-1 left-0 z-50 max-h-60 w-full overflow-auto rounded-lg py-1 shadow-md ring-1"
          >
            {filteredItems.map((option, index) => {
              const isParent = disableParentSelection && option.hasChildren;
              const isActive = activeIndex === index;
              return (
                <button
                  type="button"
                  key={option.id}
                  role="option"
                  aria-selected={isActive}
                  disabled={isParent}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-base outline-none',
                    isParent
                      ? 'text-muted-foreground cursor-default text-sm'
                      : 'hover:bg-accent cursor-pointer',
                    isActive && !isParent && 'bg-accent',
                  )}
                  style={{
                    paddingLeft: `${12 + (option.level ?? 0) * 12}px`,
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    if (!isParent) {
                      selectOption(option);
                    }
                  }}
                >
                  <span
                    className={
                      isParent ? 'text-muted-foreground text-sm' : undefined
                    }
                  >
                    {option.label}
                  </span>
                  {showDefinitions && option.definition && !isParent ? (
                    <span className="text-muted-foreground text-left text-sm text-wrap">
                      {option.definition}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
