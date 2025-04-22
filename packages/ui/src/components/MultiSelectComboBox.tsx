'use client';

import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Label } from './Field';

interface Option {
  id: string;
  label: string;
}

export const MultiSelectComboBox = ({
  items = [],
  label,
  isRequired,
}: {
  items: Array<Option>;
  label?: string;
  isRequired?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Array<Option>>([]);
  const [otherValue, setOtherValue] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const dropdownRef = useRef(null);
  const otherInputRef = useRef(null);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus on the "Other" input field when it becomes visible
  useEffect(() => {
    if (showOtherInput && otherInputRef.current) {
      otherInputRef.current.focus();
    }
  }, [showOtherInput]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option) => {
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

  const handleRemoveOption = (option, e) => {
    e.stopPropagation();

    if (option.isOther) {
      // If removing the "Other" option, also reset other-related states
      setSelectedOptions(selectedOptions.filter((item) => !item.isOther));
      setOtherValue('');
      setShowOtherInput(false);
    } else {
      setSelectedOptions(
        selectedOptions.filter((item) => item.id !== option.id),
      );
    }
  };

  const handleOtherClick = () => {
    setShowOtherInput(true);
  };

  const handleOtherInputChange = (e) => {
    setOtherValue(e.target.value);
  };

  const handleOtherInputKeyDown = (e) => {
    if (e.key === 'Enter' && otherValue.trim()) {
      // Add the custom "Other" option
      const otherOption = {
        id: 'other',
        label: otherValue,
        isOther: true,
      };

      // Remove any existing "Other" option
      const filteredOptions = selectedOptions.filter((item) => !item.isOther);

      setSelectedOptions([...filteredOptions, otherOption]);
      setShowOtherInput(false);
    } else if (e.key === 'Escape') {
      setShowOtherInput(false);
      setOtherValue('');
    }
  };

  const handleOtherInputBlur = () => {
    if (otherValue.trim()) {
      // Add the custom "Other" option on blur if there's a value
      const otherOption = {
        id: 'other',
        label: otherValue,
        isOther: true,
      };

      // Remove any existing "Other" option
      const filteredOptions = selectedOptions.filter((item) => !item.isOther);

      setSelectedOptions([...filteredOptions, otherOption]);
    }

    setShowOtherInput(false);
  };

  return (
    <div className="w-full">
      <Label>
        {label}
        {isRequired && <span className="text-red"> *</span>}
      </Label>

      <div className="relative" ref={dropdownRef}>
        {/* Dropdown button / Selected options display */}
        <div
          className="flex min-h-10 w-full cursor-pointer flex-wrap items-center rounded-md border border-offWhite bg-white px-3 py-2 text-sm"
          onClick={toggleDropdown}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-gray-500">Select options...</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <div
                  key={option.isOther ? 'other' : option.id}
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
            </div>
          )}

          <div className="ml-auto">
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            <ul className="max-h-60 overflow-auto py-1">
              {items.map((option) => (
                <li
                  key={option.id}
                  className={`flex cursor-pointer items-center px-3 py-2 text-sm hover:bg-gray-100 ${
                    selectedOptions.some((item) => item.id === option.id)
                      ? 'bg-blue-50'
                      : ''
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  <div
                    className={`mr-2 flex size-5 items-center justify-center rounded border ${
                      selectedOptions.some((item) => item.id === option.id)
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedOptions.some((item) => item.id === option.id) && (
                      <Check size={14} />
                    )}
                  </div>
                  {option.label}
                </li>
              ))}

              {/* "Other" option */}
              {!showOtherInput && (
                <li
                  className="flex cursor-pointer items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleOtherClick}
                >
                  <div className="mr-2 flex size-5 items-center justify-center text-gray-400">
                    <Plus size={14} />
                  </div>
                  Add "Other" option
                </li>
              )}

              {/* "Other" input field */}
              {showOtherInput && (
                <li className="px-3 py-2">
                  <input
                    ref={otherInputRef}
                    type="text"
                    className="w-full rounded border border-gray-300 p-1 text-sm"
                    placeholder="Type and press Enter..."
                    value={otherValue}
                    onChange={handleOtherInputChange}
                    onKeyDown={handleOtherInputKeyDown}
                    onBlur={handleOtherInputBlur}
                  />
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
