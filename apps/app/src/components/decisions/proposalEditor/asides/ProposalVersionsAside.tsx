'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { useRelativeTime } from '@op/hooks';
import type { THistoryVersion } from '@tiptap-pro/provider';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../../collaboration';
import { ProposalEditorAside } from '../../ProposalEditorAside';

/** Show relative time (e.g. "5 minutes ago") for versions newer than 24 hours. */
const RELATIVE_TIME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface ProposalVersionsAsideProps {
  onClose: () => void;
}

/**
 * Aside panel for proposal version history.
 * Reads versions directly from the TipTap collaboration provider.
 */
export function ProposalVersionsAside({ onClose }: ProposalVersionsAsideProps) {
  const locale = useLocale();
  const t = useTranslations();
  const { provider } = useCollaborativeDoc();

  const readVersions = useCallback(
    () => [...provider.getVersions()].sort((a, b) => b.version - a.version),
    [provider],
  );

  const [versions, setVersions] = useState<THistoryVersion[]>(readVersions);

  useEffect(() => {
    const onUpdate = () => setVersions(readVersions());
    provider.watchVersions(onUpdate);
    return () => provider.unwatchVersions(onUpdate);
  }, [provider, readVersions]);

  return (
    <ProposalEditorAside
      title={t('Version history')}
      onClose={onClose}
      bodyClassName="pt-4"
    >
      <div className="mx-4 rounded bg-primary-tealWhite p-2">
        <p className="text-base text-neutral-black">{t('Current version')}</p>
        <p className="text-sm text-neutral-charcoal">{t('Latest')}</p>
      </div>

      <div>
        {versions.map((version) => {
          const createdAt = new Date(version.date).toISOString();
          const isRecent =
            Date.now() - version.date < RELATIVE_TIME_THRESHOLD_MS;

          return (
            <VersionItem
              key={version.version}
              createdAt={createdAt}
              isRecent={isRecent}
              locale={locale}
            />
          );
        })}
      </div>
    </ProposalEditorAside>
  );
}

function VersionItem({
  createdAt,
  isRecent,
  locale,
}: {
  createdAt: string;
  isRecent: boolean;
  locale: string;
}) {
  const t = useTranslations();
  const relativeTime = useRelativeTime(createdAt, { style: 'long' });

  const label = isRecent
    ? relativeTime
    : formatDate(createdAt, locale, DATE_TIME_UTC_FORMAT);

  return (
    <div className="mx-4 p-2">
      <p className="text-base text-neutral-black">{label}</p>
      <p className="text-sm text-neutral-charcoal">{t('Auto-saved')}</p>
    </div>
  );
}
