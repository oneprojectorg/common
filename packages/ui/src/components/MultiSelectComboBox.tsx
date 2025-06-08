'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ValidationResult } from 'react-aria-components';

import { FieldError, Label } from './Field';

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
}: MultiSelectComboBoxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const selectedOptions = value ?? [];
  const setSelectedOptions = onChange ?? (() => {});

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showOtherInput && otherInputRef.current) {
      otherInputRef.current.focus();
    }
  }, [showOtherInput]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);

    if (!isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleOptionClick = (option: Option) => {
    // Don't allow selection of parent terms if disableParentSelection is true
    if (disableParentSelection && option.hasChildren) {
      return;
    }

    // Check if option is already selected
    const isSelected = selectedOptions.some((item) => item.id === option.id);

    if (isSelected) {
      // Remove option if already selected
      setSelectedOptions(
        selectedOptions.filter((item) => item.id !== option.id),
      );
    } else {
      // Add option if not selected
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const handleRemoveOption = (
    option: Option,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();

    if (option.isNewValue) {
      // If removing the "Other" option, also reset other-related states
      setSelectedOptions(selectedOptions.filter((item) => !item.isNewValue));
      setShowOtherInput(false);
    } else {
      setSelectedOptions(
        selectedOptions.filter((item) => item.id !== option.id),
      );
    }
  };

  // Filter items based on inputValue and not already selected
  const filteredItems = items.filter(
    (option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedOptions.some((item) => item.id === option.id),
  );

  // Helper functions for tree navigation
  const isItemSelectable = (item: Option): boolean => {
    if (!disableParentSelection) return true;
    return !item.hasChildren;
  };

  const findNextSelectableIndex = (currentIndex: number): number => {
    for (let i = currentIndex + 1; i < filteredItems.length; i++) {
      if (isItemSelectable(filteredItems[i]!)) {
        return i;
      }
    }
    // If no next selectable item found, wrap to first selectable
    for (let i = 0; i <= currentIndex; i++) {
      if (isItemSelectable(filteredItems[i]!)) {
        return i;
      }
    }
    return -1; // No selectable items found
  };

  const findPreviousSelectableIndex = (currentIndex: number): number => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (isItemSelectable(filteredItems[i]!)) {
        return i;
      }
    }
    // If no previous selectable item found, wrap to last selectable
    for (let i = filteredItems.length - 1; i >= currentIndex; i--) {
      if (isItemSelectable(filteredItems[i]!)) {
        return i;
      }
    }
    return -1; // No selectable items found
  };

  const findFirstSelectableIndex = (): number => {
    for (let i = 0; i < filteredItems.length; i++) {
      if (isItemSelectable(filteredItems[i]!)) {
        return i;
      }
    }
    return -1; // No selectable items found
  };

  // Reset highlighted index if filteredItems changes
  useEffect(() => {
    if (!isOpen || filteredItems.length === 0) {
      setHighlightedIndex(-1);
    } else if (
      highlightedIndex >= filteredItems.length ||
      (highlightedIndex >= 0 &&
        !isItemSelectable(filteredItems[highlightedIndex]!))
    ) {
      setHighlightedIndex(findFirstSelectableIndex());
    }
  }, [filteredItems, isOpen, highlightedIndex, disableParentSelection]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputUpdate?.(e.target.value ?? '');
    setInputValue(e.target.value ?? '');
    setIsOpen(true);
    setHighlightedIndex(findFirstSelectableIndex());
  };

  // Add inputValue as a new tag if not empty and not already selected
  const addInputAsTag = () => {
    if (!allowAdditions) {
      return;
    }

    const trimmed = inputValue.trim();

    if (trimmed && !selectedOptions.some((item) => item.label === trimmed)) {
      setSelectedOptions([...selectedOptions, { id: trimmed, label: trimmed }]);
    }

    setInputValue('');
  };

  // Handle input keydown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === 'Backspace' &&
      inputValue === '' &&
      selectedOptions.length > 0
    ) {
      setSelectedOptions(selectedOptions.slice(0, -1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (filteredItems.length > 0) {
        setIsOpen(true);
        setHighlightedIndex((prev) => {
          if (prev === -1) {
            return findFirstSelectableIndex();
          }
          return findNextSelectableIndex(prev);
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();

      if (filteredItems.length > 0) {
        setIsOpen(true);
        setHighlightedIndex((prev) => {
          if (prev === -1) {
            return findFirstSelectableIndex();
          }
          return findPreviousSelectableIndex(prev);
        });
      }
    } else if (
      e.key === 'Tab' &&
      isOpen &&
      filteredItems.length > 0 &&
      highlightedIndex >= 0
    ) {
      e.preventDefault();
      const chosen = filteredItems[highlightedIndex];

      if (chosen && isItemSelectable(chosen)) {
        handleOptionClick(chosen);
      }

      setInputValue('');
      setHighlightedIndex(-1);
    } else if (e.key === 'Enter') {
      // Add input as tag if not empty, even if dropdown is open.
      e.preventDefault();
      addInputAsTag();
    } else if (e.key === 'Tab') {
      addInputAsTag();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);

      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    addInputAsTag();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Label>
        {label}
        {isRequired && <span className="text-red"> *</span>}
      </Label>

      <div className="relative" ref={dropdownRef}>
        {/* Dropdown button / Selected options display */}
        <div
          className="flex min-h-10 w-full cursor-pointer flex-wrap items-center rounded-md border border-offWhite bg-white px-3 py-2 text-base hover:border-neutral-gray2"
          onClick={() => {
            // Only toggle if input is NOT focused
            if (document.activeElement !== inputRef.current) {
              toggleDropdown();
            }
          }}
        >
          <div className="relative flex w-full flex-wrap items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              className="ml-1 min-w-[40px] flex-1 border-none bg-transparent pr-7 text-base outline-none placeholder:text-neutral-gray4 group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              onFocus={() => {
                if (filteredItems.length > 0) {
                  setIsOpen(true);
                  if (highlightedIndex === -1) {
                    setHighlightedIndex(findFirstSelectableIndex());
                  }
                }
              }}
              onMouseDown={() => {
                // Open dropdown before focus event
                if (filteredItems.length > 0) {
                  setIsOpen(true);
                  if (highlightedIndex === -1) {
                    setHighlightedIndex(findFirstSelectableIndex());
                  }
                }
              }}
              placeholder={placeholder}
              style={{ minWidth: 40 }}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-charcoal">
              <Search className="size-4" />
            </span>
          </div>
          <FieldError>{errorMessage}</FieldError>
        </div>

        {/* Selected options below input box, not inside */}
        {selectedOptions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <div
                key={option.isNewValue ? 'other' : option.id}
                className="flex items-center rounded bg-black/5 p-2 text-charcoal"
              >
                <span>{option.label}</span>
                <button
                  type="button"
                  className="ml-1"
                  onClick={(e) => handleRemoveOption(option, e)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <FieldError>{errorMessage}</FieldError>

        {/* Dropdown menu - always below input and selected options */}
        {isOpen && filteredItems.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            <ul ref={listRef} className="max-h-60 overflow-auto py-1">
              {filteredItems.map((option, idx) => {
                const isParent = disableParentSelection && option.hasChildren;
                const isSelected = selectedOptions.some(
                  (item) => item.id === option.id,
                );
                const isHighlighted = highlightedIndex === idx;

                return (
                  <li
                    key={option.id}
                    className={`flex flex-col items-start px-3 py-2 text-base ${
                      isParent
                        ? 'cursor-default py-2 pt-2 text-sm text-neutral-gray4' // parent styling
                        : `cursor-pointer hover:bg-neutral-gray1 ${
                            isSelected ? 'bg-neutral-gray1' : ''
                          } ${isHighlighted ? 'bg-neutral-gray1' : ''}`
                    }`}
                    onMouseEnter={() => !isParent && setHighlightedIndex(idx)}
                    onMouseLeave={() => setHighlightedIndex(-1)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleOptionClick(option);
                      setInputValue('');
                      setHighlightedIndex(-1);
                    }}
                  >
                    <span
                      className={isParent ? 'text-sm text-neutral-gray4' : ''}
                    >
                      {option.label}
                    </span>
                    {showDefinitions && option.definition && !isParent ? (
                      <span className="overflow-hidden text-ellipsis text-nowrap text-sm text-neutral-charcoal">
                        {option.definition}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
