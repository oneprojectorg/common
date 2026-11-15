'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { DevelopOriginEntry } from '@op/common/client';
import { Toggle } from '@op/sense/Toggle';
import { LuCheck, LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { PrepareEntryButton } from './PrepareEntryButton';

/**
 * An origin's row actions. Without an entry of the caller: Prepare, which
 * creates one. With one: a link into that entry (Prepare while it is a draft,
 * Edit once it is ready) and Advance, which marks the draft ready. A ready
 * entry cannot go back to draft, so Advance then stays pressed.
 */
export function DevelopOriginActions({
  title,
  entry,
  entryHref,
  isDisabled,
  isPreparing,
  isAdvancing,
  onPrepare,
  onAdvance,
}: {
  /** The origin's title, which names the actions for screen readers. */
  title: string;
  /** The caller's entry developed from this origin, if any. */
  entry: DevelopOriginEntry | undefined;
  entryHref: (entry: Pick<DevelopOriginEntry, 'profileId'>) => string;
  /** Another entry is being created, opened or marked ready. */
  isDisabled: boolean;
  /** This origin's entry is being created or opened. */
  isPreparing: boolean;
  /** This origin's entry is being marked ready. */
  isAdvancing: boolean;
  onPrepare: () => void;
  onAdvance: (entry: DevelopOriginEntry) => void;
}) {
  const t = useTranslations('decisions.develop');

  if (!entry) {
    return (
      <PrepareEntryButton
        title={title}
        isDisabled={isDisabled}
        isPreparing={isPreparing}
        onPrepare={onPrepare}
      />
    );
  }

  const isReady = entry.status !== ProposalStatus.DRAFT;

  return (
    <div className="flex items-center justify-end gap-2">
      <ButtonLink
        href={entryHref(entry)}
        variant="outline"
        aria-label={
          isReady
            ? t('editEntryLabel', { title })
            : t('continueEntryLabel', { title })
        }
      >
        <LuPencil aria-hidden data-icon="inline-start" />
        {isReady ? t('editEntryAction') : t('prepareEntryAction')}
      </ButtonLink>
      <Toggle
        variant="outline"
        pressed={isReady || isAdvancing}
        disabled={isReady || isDisabled}
        onPressedChange={() => onAdvance(entry)}
        aria-label={t('advanceEntryLabel', { title })}
      >
        {isReady ? <LuCheck aria-hidden data-icon="inline-start" /> : null}
        {isReady ? t('advancedEntryAction') : t('advanceEntryAction')}
      </Toggle>
    </div>
  );
}
