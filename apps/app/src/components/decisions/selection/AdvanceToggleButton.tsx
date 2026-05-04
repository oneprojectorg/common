'use client';

import { Button } from '@op/ui/Button';
import { cn } from '@op/ui/utils';
import { LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function AdvanceToggleButton({
  isSelected,
  onPress,
  title,
  className,
}: {
  isSelected: boolean;
  onPress: () => void;
  /** Proposal title — surfaced as the button's accessible name so screen
   * readers and tests can disambiguate between rows. */
  title: string;
  className?: string;
}) {
  const t = useTranslations();

  return (
    <Button
      size="small"
      color={isSelected ? 'verified' : 'secondary'}
      onPress={onPress}
      aria-label={
        isSelected
          ? t("Don't advance {title}", { title })
          : t('Advance {title}', { title })
      }
      // rounded-lg overrides the small-size default (rounded-md) so the
      // radius matches the Confirm button in the FooterBar.
      className={cn('relative rounded-lg', className)}
    >
      {/* Invisible placeholder reserves the wider "Advancing" width so the
       * button doesn't reflow when its label changes. */}
      <span className="invisible flex items-center gap-1">
        <LuCheck className="size-4" />
        {t('Advancing')}
      </span>
      <span className="absolute inset-0 flex items-center justify-center gap-1">
        {isSelected ? (
          <>
            <LuCheck className="size-4" />
            {t('Advancing')}
          </>
        ) : (
          t('Advance')
        )}
      </span>
    </Button>
  );
}
