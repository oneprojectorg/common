'use client';

import * as React from 'react';
import { LuLanguages, LuX } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface TranslateBannerProps extends Omit<
  React.ComponentProps<'div'>,
  'children'
> {
  onTranslate: () => void;
  onDismiss: () => void;
  label: string;
  translateAriaLabel?: string;
  dismissAriaLabel?: string;
  /** Disables the translate button to prevent duplicate requests. */
  isTranslating?: boolean;
  tooltip?: string;
}

/**
 * Translation call-to-action banner used in proposal views: a translate
 * button with a language icon, and a dismiss button.
 */
function TranslateBanner({
  onTranslate,
  onDismiss,
  label,
  translateAriaLabel,
  dismissAriaLabel = 'Dismiss',
  isTranslating = false,
  tooltip,
  className,
  ...props
}: TranslateBannerProps) {
  const translateButton = (
    <button
      type="button"
      onClick={onTranslate}
      disabled={isTranslating}
      aria-label={translateAriaLabel ?? label}
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full text-start text-primary transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent">
        <LuLanguages className="size-4" />
      </span>
      <span className="leading-5 whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <div
      data-slot="translate-banner"
      className={cn(
        'flex w-full max-w-md items-center gap-2 rounded-md border bg-background px-4 py-3 shadow-sm',
        className,
      )}
      {...props}
    >
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger render={translateButton} />
          <TooltipContent className="sense">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        translateButton
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissAriaLabel}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <LuX className="size-4" />
      </button>
    </div>
  );
}

export { TranslateBanner };
