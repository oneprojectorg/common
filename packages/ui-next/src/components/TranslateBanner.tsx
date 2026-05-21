import { LuLanguages, LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { Tooltip, TooltipTrigger } from './Tooltip';

export interface TranslateBannerProps extends Omit<
  React.ComponentProps<'div'>,
  'children'
> {
  onTranslate: () => void;
  onDismiss: () => void;
  label: string;
  translateAriaLabel?: string;
  dismissAriaLabel?: string;
  isTranslating?: boolean;
  tooltip?: string;
}

/**
 * Translation call-to-action banner used in proposal views.
 *
 * Displays a translate button with a language icon and a dismiss button.
 * The `isTranslating` prop disables the translate button to prevent duplicate requests.
 */
export const TranslateBanner = ({
  onTranslate,
  onDismiss,
  label,
  translateAriaLabel,
  dismissAriaLabel = 'Dismiss',
  isTranslating = false,
  tooltip,
  className,
  ...props
}: TranslateBannerProps) => {
  const translateButton = (
    <Button
      onPress={onTranslate}
      isDisabled={isTranslating}
      aria-label={translateAriaLabel ?? label}
      unstyled
      className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full text-left text-primary-teal outline-hidden transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tealWhite">
        <LuLanguages className="size-4" />
      </span>
      <span className="text-sm leading-5 whitespace-nowrap">{label}</span>
    </Button>
  );

  return (
    <div
      className={cn(
        'flex w-full max-w-md items-center gap-2 rounded-2xl border border-neutral-gray1 bg-white px-3 py-2 shadow-light',
        className,
      )}
      {...props}
    >
      {tooltip ? (
        <TooltipTrigger>
          {translateButton}
          <Tooltip>{tooltip}</Tooltip>
        </TooltipTrigger>
      ) : (
        translateButton
      )}

      <Button
        onPress={onDismiss}
        aria-label={dismissAriaLabel}
        unstyled
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-gray4 outline-hidden transition-colors hover:bg-neutral-gray1 hover:text-neutral-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue"
      >
        <LuX className="size-5" />
      </Button>
    </div>
  );
};
