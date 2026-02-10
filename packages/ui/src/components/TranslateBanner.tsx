'use client';

import { Languages, X } from 'lucide-react';

import { cn } from '../lib/utils';

export interface TranslateBannerProps
  extends Omit<React.ComponentProps<'div'>, 'children'> {
  onTranslate: () => void;
  onDismiss: () => void;
  label: string;
  translateAriaLabel?: string;
  dismissAriaLabel?: string;
  isTranslating?: boolean;
}

/**
 * Translation call-to-action banner used in proposal views.
 */
export const TranslateBanner = ({
  onTranslate,
  onDismiss,
  label,
  translateAriaLabel,
  dismissAriaLabel = 'Dismiss',
  isTranslating = false,
  className,
  ...props
}: TranslateBannerProps) => {
  return (
    <div
      className={cn(
        'flex w-full max-w-md items-center gap-2 rounded-2xl border border-neutral-gray1 bg-white px-3 py-2 shadow-light',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        onClick={onTranslate}
        disabled={isTranslating}
        aria-label={translateAriaLabel ?? label}
        className={cn(
          'group flex min-w-0 flex-1 items-center gap-2 rounded-full text-left text-primary-teal outline-hidden transition-opacity disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <span
          className={
            'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tealWhite text-primary-teal'
          }
        >
          <Languages className="size-4" strokeWidth={2.25} />
        </span>
        <span className="text-sm leading-5 font-normal whitespace-nowrap">
          {label}
        </span>
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissAriaLabel}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-gray4 outline-hidden transition-colors hover:bg-neutral-gray1 hover:text-neutral-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue',
        )}
      >
        <X className="size-6" strokeWidth={1.75} />
      </button>
    </div>
  );
};
