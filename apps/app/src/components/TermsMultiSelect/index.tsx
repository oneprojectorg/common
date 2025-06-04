'use client';

import { trpc } from '@op/api/client';
import type { TermWithChildren } from '@op/common';
import { FieldError, Label } from '@op/ui/Field';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ValidationResult } from 'react-aria-components';

type FlattenedTerm = Option & {
  level: number;
  hasChildren: boolean;
};

const flattenTermTree = (
  terms: TermWithChildren[],
  level = 0,
): FlattenedTerm[] => {
  return terms.reduce<FlattenedTerm[]>((acc, term) => {
    const flatTerm: FlattenedTerm = {
      id: term.id,
      label: term.label,
      definition: term.definition,
      level,
      hasChildren: term.children.length > 0,
    };

    acc.push(flatTerm);

    if (term.children.length > 0) {
      acc.push(...flattenTermTree(term.children, level + 1));
    }

    return acc;
  }, []);
};

type TreeMultiSelectComboBoxProps = {
  items: Array<FlattenedTerm>;
  label?: string;
  placeholder?: string;
  isRequired?: boolean;
  value?: Array<Option>;
  onChange?: (value: Array<Option>) => void;
  onInputUpdate?: (value: string) => void;
  errorMessage?: string | ((validation: ValidationResult) => string);
  showDefinitions?: boolean;
};

const TreeMultiSelectComboBox = ({
  items = [],
  label,
  placeholder,
  isRequired,
  value,
  onChange,
  onInputUpdate,
  errorMessage,
  showDefinitions = false,
}: TreeMultiSelectComboBoxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
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

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleOptionClick = (option: FlattenedTerm) => {
    // Don't allow selection of parent terms
    if (option.hasChildren) {
      return;
    }

    const isSelected = selectedOptions.some((item) => item.id === option.id);
    if (isSelected) {
      setSelectedOptions(
        selectedOptions.filter((item) => item.id !== option.id),
      );
    } else {
      setSelectedOptions([
        ...selectedOptions,
        { id: option.id, label: option.label },
      ]);
    }
  };

  const handleRemoveOption = (
    option: Option,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    setSelectedOptions(selectedOptions.filter((item) => item.id !== option.id));
  };

  // Filter items based on inputValue and not already selected
  const filteredItems = items.filter(
    (option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedOptions.some((item) => item.id === option.id),
  );

  // Reset highlighted index if filteredItems changes
  useEffect(() => {
    if (!isOpen || filteredItems.length === 0) {
      setHighlightedIndex(-1);
    } else if (
      highlightedIndex >= filteredItems.length ||
      (highlightedIndex >= 0 && filteredItems[highlightedIndex]?.hasChildren)
    ) {
      setHighlightedIndex(findFirstSelectableIndex());
    }
  }, [filteredItems, isOpen, highlightedIndex]);

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

  // Helper functions for keyboard navigation
  const findNextSelectableIndex = (currentIndex: number): number => {
    for (let i = currentIndex + 1; i < filteredItems.length; i++) {
      if (!filteredItems[i]?.hasChildren) {
        return i;
      }
    }
    // If no next selectable item found, wrap to first selectable
    for (let i = 0; i <= currentIndex; i++) {
      if (!filteredItems[i]?.hasChildren) {
        return i;
      }
    }
    return -1; // No selectable items found
  };

  const findPreviousSelectableIndex = (currentIndex: number): number => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (!filteredItems[i]?.hasChildren) {
        return i;
      }
    }
    // If no previous selectable item found, wrap to last selectable
    for (let i = filteredItems.length - 1; i >= currentIndex; i--) {
      if (!filteredItems[i]?.hasChildren) {
        return i;
      }
    }
    return -1; // No selectable items found
  };

  const findFirstSelectableIndex = (): number => {
    for (let i = 0; i < filteredItems.length; i++) {
      if (!filteredItems[i]?.hasChildren) {
        return i;
      }
    }
    return -1; // No selectable items found
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputUpdate?.(e.target.value ?? '');
    setInputValue(e.target.value ?? '');
    setIsOpen(true);
    setHighlightedIndex(findFirstSelectableIndex());
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
      if (chosen && !chosen.hasChildren) {
        handleOptionClick(chosen);
      }
      setInputValue('');
      setHighlightedIndex(-1);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Label>
        {label}
        {isRequired && <span className="text-red"> *</span>}
      </Label>

      <div className="relative" ref={dropdownRef}>
        <div
          className="flex min-h-10 w-full cursor-pointer flex-wrap items-center rounded-md border border-offWhite bg-white px-3 py-2 text-base hover:border-neutral-gray2"
          onClick={() => {
            if (document.activeElement !== inputRef.current) {
              toggleDropdown();
            }
          }}
        >
          <div className="relative flex w-full flex-wrap items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              className="ml-1 min-w-[40px] flex-1 border-none bg-transparent pr-7 text-base outline-none placeholder:text-neutral-gray4"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={() => {
                if (filteredItems.length > 0) {
                  setIsOpen(true);
                  if (highlightedIndex === -1) {
                    setHighlightedIndex(findFirstSelectableIndex());
                  }
                }
              }}
              onMouseDown={() => {
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
        </div>

        {selectedOptions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <div
                key={option.id}
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

        {isOpen && filteredItems.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            <ul ref={listRef} className="max-h-60 overflow-auto py-1">
              {filteredItems.map((option, idx) => (
                <li
                  key={option.id}
                  className={`flex flex-col px-3 py-2 text-base ${
                    option.hasChildren
                      ? 'h-6 cursor-default py-0 pt-2 text-sm text-neutral-gray4' // parent
                      : `cursor-pointer hover:bg-neutral-gray1 ${
                          selectedOptions.some((item) => item.id === option.id)
                            ? 'bg-neutral-gray1'
                            : ''
                        } ${highlightedIndex === idx ? 'bg-neutral-gray1' : ''}`
                  }`}
                  onMouseEnter={() =>
                    !option.hasChildren && setHighlightedIndex(idx)
                  }
                  onMouseLeave={() => setHighlightedIndex(-1)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    handleOptionClick(option);
                    setInputValue('');
                    setHighlightedIndex(-1);
                  }}
                >
                  <span
                    className={
                      option.hasChildren ? 'text-sm text-neutral-gray4' : ''
                    }
                  >
                    {option.label}
                  </span>
                  {showDefinitions && option.definition ? (
                    <span className="overflow-hidden text-ellipsis text-nowrap text-sm text-neutral-charcoal">
                      {option.definition}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export const TermsMultiSelect = ({
  label,
  placeholder,
  value,
  onChange,
  taxonomy,
  isRequired = false,
  errorMessage,
}: {
  label?: string;
  placeholder?: string;
  taxonomy: string;
  value: Array<Option>;
  onChange: (value: Array<Option>) => void;
  isRequired?: boolean;
  errorMessage?: string;
}) => {
  const [termsQuery, setTermsQuery] = useState('');
  const { data: terms } = trpc.taxonomy.getTerms.useQuery({
    name: taxonomy,
    q: termsQuery.length >= 2 ? termsQuery : undefined,
  });

  const flattenedTerms = terms ? flattenTermTree(terms) : [];

  return (
    <TreeMultiSelectComboBox
      label={label}
      placeholder={placeholder ?? 'Select one or more…'}
      isRequired={isRequired}
      onChange={(value) => onChange(value)}
      onInputUpdate={(inputValue) => {
        setTermsQuery(inputValue);
      }}
      value={value ?? []}
      items={flattenedTerms}
      errorMessage={errorMessage}
    />
  );
};
