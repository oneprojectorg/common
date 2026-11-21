'use client';

import { Button } from '@op/sense/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { useId } from 'react';

import { useTranslations } from '@/lib/i18n';

// Untranslated on purpose: temporary copy until the launch milestone ships.
const LAUNCH_UNAVAILABLE_HINT =
  'Launching from this page is not available yet. Launch from the editor.';

/**
 * The draft bar's launch control. Launching from this page lands with the
 * launch milestone; until then the button stays visible, inert and explained,
 * to pointer users by tooltip and to everyone else by its description.
 */
export function ProcessAdminLaunchButton() {
  const t = useTranslations('decisions.processAdmin');
  const hintId = useId();

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-disabled
              aria-describedby={hintId}
              className="cursor-not-allowed opacity-50"
              onClick={(event) => event.preventDefault()}
            />
          }
        >
          {t('launchAction')}
        </TooltipTrigger>
        <TooltipContent>{LAUNCH_UNAVAILABLE_HINT}</TooltipContent>
      </Tooltip>
      <span id={hintId} className="sr-only">
        {LAUNCH_UNAVAILABLE_HINT}
      </span>
    </>
  );
}
