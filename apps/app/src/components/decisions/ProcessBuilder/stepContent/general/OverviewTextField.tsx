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

function focusNext(current: HTMLElement) {
  const focusables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'textarea, input, [contenteditable="true"]',
    ),
  ).filter((el) => !el.hasAttribute('disabled'));
  const i = focusables.indexOf(current);
  focusables[i + 1]?.focus();
}

export function OverviewTextField({
  variant,
  value,
  onChange,
  placeholder,
  maxLength,
}: OverviewTextFieldProps) {
  return (
    <textarea
      rows={1}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // These are single-line — block Enter (no newlines) and advance to the
        // next field instead.
        if (e.key === 'Enter') {
          e.preventDefault();
          focusNext(e.currentTarget);
        }
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        // field-sizing-content grows the textarea with its content so long
        // headlines/descriptions wrap instead of getting cut off.
        'field-sizing-content w-full resize-none overflow-hidden bg-transparent text-neutral-charcoal placeholder:text-neutral-gray3 focus:outline-none',
        variant === 'headline' && 'font-serif text-title-lg',
        variant === 'description' && 'text-base',
      )}
    />
  );
}
