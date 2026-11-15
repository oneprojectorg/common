'use client';

import { Button } from '@op/sense/Button';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Prepares an entry of the current phase from one origin. */
export function PrepareEntryButton({
  title,
  onPrepare,
  isDisabled,
  isPreparing,
}: {
  /** The origin's title, which names the action for screen readers. */
  title: string;
  onPrepare: () => void;
  /** Another entry is being created or opened. */
  isDisabled: boolean;
  /** This origin's entry is being created or opened. */
  isPreparing: boolean;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <Button
      variant="outline"
      aria-label={t('prepareEntryLabel', { title })}
      disabled={isDisabled}
      loading={isPreparing}
      onClick={onPrepare}
    >
      <LuPencil aria-hidden data-icon="inline-start" />
      {t('prepareEntryAction')}
    </Button>
  );
}
