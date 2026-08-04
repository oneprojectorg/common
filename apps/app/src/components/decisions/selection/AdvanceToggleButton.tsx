'use client';

import { Toggle } from '@op/sense/Toggle';
import { cn } from '@op/sense/lib/utils';
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
  /** Proposal title — surfaced as the toggle's accessible name so screen
   * readers and tests can disambiguate between rows. The pressed state
   * conveys whether the proposal is advancing. */
  title: string;
  className?: string;
}) {
  const t = useTranslations();

  return (
    <Toggle
      variant="outline"
      pressed={isSelected}
      onPressedChange={onPress}
      aria-label={
        isSelected
          ? t("Don't advance {title}", { title })
          : t('Advance {title}', { title })
      }
      // rounded-lg overrides the sm default (rounded-md) so the radius matches
      // the Confirm button in the FooterBar.
      className={cn('relative rounded-lg', className)}
    >
      {/* Label stays "Advance" in both states (per design); only the check
       * icon toggles. Invisible placeholder always includes the icon so the
       * toggle reserves the checked-state width and doesn't reflow on press. */}
      <span className="invisible flex items-center gap-1">
        <LuCheck className="size-4" />
        {t('Advance')}
      </span>
      <span className="absolute inset-0 flex items-center justify-center gap-1">
        {isSelected && <LuCheck className="size-4" />}
        {t('Advance')}
      </span>
    </Toggle>
  );
}
