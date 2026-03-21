'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { useRelativeTime } from '@op/hooks';
import type { THistoryVersion } from '@tiptap-pro/provider';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../../collaboration';
import { ProposalEditorAside } from '../../ProposalEditorAside';

const RELATIVE_TIME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface ProposalVersionsAsideProps {
  versionId: number | null;
  onSelectVersion: (versionId: number) => void;
  onClose: () => void;
}

export function ProposalVersionsAside({
  versionId,
  onSelectVersion,
  onClose,
}: ProposalVersionsAsideProps) {
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
              isSelected={versionId === version.version}
              onSelect={() => onSelectVersion(version.version)}
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
  isSelected,
  onSelect,
}: {
  createdAt: string;
  isRecent: boolean;
  locale: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const relativeTime = useRelativeTime(createdAt, { style: 'long' });

  const label = isRecent
    ? relativeTime
    : formatDate(createdAt, locale, DATE_TIME_UTC_FORMAT);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mx-4 w-[calc(100%-2rem)] cursor-pointer rounded p-2 text-left ${
        isSelected ? 'bg-primary-tealWhite' : 'hover:bg-neutral-offWhite'
      }`}
    >
      <p className="text-base text-neutral-black">{label}</p>
      <p className="text-sm text-neutral-charcoal">{t('Auto-saved')}</p>
    </button>
  );
}
