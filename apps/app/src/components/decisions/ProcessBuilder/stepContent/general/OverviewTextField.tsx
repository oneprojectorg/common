'use client';

import { cn } from '@op/sense/lib/utils';

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
  const showCount = variant === 'headline';

  const textarea = (
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
        'field-sizing-content resize-none overflow-hidden bg-transparent placeholder:text-muted-foreground focus:outline-none',
        showCount ? 'min-w-0 flex-1' : 'w-full',
        variant === 'headline' && 'font-serif text-headline font-light',
        variant === 'description' && 'text-base',
      )}
    />
  );

  if (!showCount) {
    return textarea;
  }

  return (
    <div className="flex items-end justify-between gap-2">
      {textarea}
      {/* Always rendered to reserve space; fades in once there's text. */}
      <span
        aria-hidden="true"
        className={cn(
          'shrink-0 text-sm transition-opacity',
          value.length > 0 ? 'opacity-100' : 'opacity-0',
          value.length >= maxLength ? 'text-destructive' : 'text-foreground',
        )}
      >
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
