'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Label } from './Field';

export interface Option {
  id: string;
  label: string;
  isNewValue?: boolean;
}

export const MultiSelectComboBox = ({
  items = [],
  label,
  placeholder,
  isRequired,
  value,
  onChange,
}: {
  items: Array<Option>;
  label?: string;
  placeholder?: string;
  isRequired?: boolean;
  value?: Array<Option>;
  onChange?: (value: Array<Option>) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

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

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  // Add inputValue as a new tag if not empty and not already selected
  const addInputAsTag = () => {
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
    } else if (
      e.key === 'Enter' &&
      filteredItems.length > 0 &&
      filteredItems[0]
    ) {
      // Select the first filtered item
      handleOptionClick(filteredItems[0]);
      setInputValue('');
    } else if (e.key === 'Tab') {
      addInputAsTag();
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
          className="flex min-h-10 w-full cursor-pointer flex-wrap items-center rounded-md border border-offWhite bg-white px-4 py-2 text-sm"
          onClick={() => {
            // Only toggle if input is NOT focused
            if (document.activeElement !== inputRef.current) {
              toggleDropdown();
            }
          }}
        >
          <div className="flex w-full flex-wrap items-center gap-1">
            {selectedOptions.map((option) => (
              <div
                key={option.isNewValue ? 'other' : option.id}
                className="flex items-center rounded bg-black/5 p-2 text-charcoal"
              >
                <span>{option.label}</span>
                <button
                  type="button"
                  className="ml-1 text-blue-700 hover:text-blue-900"
                  onClick={(e) => handleRemoveOption(option, e)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <input
              ref={inputRef}
              type="text"
              className="ml-1 min-w-[40px] flex-1 border-none bg-transparent py-1 text-sm outline-none placeholder:text-midGray"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              onFocus={() => {
                if (filteredItems.length > 0) setIsOpen(true);
              }}
              onMouseDown={() => {
                // Open dropdown before focus event
                if (filteredItems.length > 0) setIsOpen(true);
              }}
              placeholder={placeholder}
              style={{ minWidth: 40 }}
            />
          </div>
        </div>

        {/* Dropdown menu */}
        {isOpen && filteredItems.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            <ul className="max-h-60 overflow-auto py-1">
              {filteredItems.map((option) => (
                <li
                  key={option.id}
                  className={`flex cursor-pointer items-center px-3 py-2 text-sm hover:bg-gray-100 ${
                    selectedOptions.some((item) => item.id === option.id)
                      ? 'bg-blue-50'
                      : ''
                  }`}
                  onClick={() => {
                    handleOptionClick(option);
                    setInputValue('');
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
