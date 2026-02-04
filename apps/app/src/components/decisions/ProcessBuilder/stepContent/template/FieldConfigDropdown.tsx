'use client';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface FieldConfigDropdownProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
}

/**
 * Configuration UI for dropdown fields.
 * Allows adding, removing, and managing dropdown options.
 */
export function FieldConfigDropdown({
  options,
  onOptionsChange,
}: FieldConfigDropdownProps) {
  const t = useTranslations();
  const [newOption, setNewOption] = useState('');

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !options.includes(trimmed)) {
      onOptionsChange([...options, trimmed]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    onOptionsChange(options.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-neutral-charcoal">
        {t('Dropdown options')}
      </h4>

      {/* Existing options */}
      {options.length > 0 && (
        <ul className="space-y-2">
          {options.map((option, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded border border-neutral-gray2 bg-white px-3 py-2"
            >
              <span className="flex-1 text-sm">{option}</span>
              <Button
                color="ghost"
                size="small"
                aria-label={t('Remove option')}
                onPress={() => handleRemoveOption(index)}
                className="p-1 text-neutral-gray4 hover:text-neutral-charcoal"
              >
                <LuX size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new option */}
      <div className="flex gap-2">
        <TextField
          aria-label={t('New option')}
          inputProps={{ placeholder: t('Add an option') }}
          value={newOption}
          onChange={setNewOption}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          color="neutral"
          size="small"
          onPress={handleAddOption}
          isDisabled={!newOption.trim()}
          aria-label={t('Add option')}
          className="shrink-0"
        >
          <LuPlus size={16} />
        </Button>
      </div>
    </div>
  );
}
