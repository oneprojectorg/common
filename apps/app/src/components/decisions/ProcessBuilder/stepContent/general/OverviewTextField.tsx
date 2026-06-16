'use client';

import { cn } from '@op/ui/utils';

// Borderless, document-style text inputs for the Overview page (headline +
// short description). Not @op/ui TextField — those are labeled/bordered; these
// are chromeless to read as page content, per the Figma design.
interface OverviewTextFieldProps {
  variant: 'headline' | 'description';
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
}

export function OverviewTextField({
  variant,
  value,
  onChange,
  placeholder,
  maxLength,
}: OverviewTextFieldProps) {
  return (
    <input
      type="text"
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        'w-full bg-transparent text-neutral-charcoal placeholder:text-neutral-gray3 focus:outline-none',
        variant === 'headline' && 'font-serif text-title-lg',
        variant === 'description' && 'text-base',
      )}
    />
  );
}
