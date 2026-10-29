'use client';

import { Button } from '@op/sense/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';

import { useTranslations } from '@/lib/i18n';

/**
 * The draft bar's launch control. Launching from this page lands with the
 * launch milestone; until then the button stays visible, inert and explained.
 */
export function ProcessAdminLaunchButton() {
  const t = useTranslations('decisions.processAdmin');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-disabled
            className="cursor-not-allowed opacity-50"
            onClick={(event) => event.preventDefault()}
          />
        }
      >
        {t('launchAction')}
      </TooltipTrigger>
      <TooltipContent>{t('launchUnavailableHint')}</TooltipContent>
    </Tooltip>
  );
}
