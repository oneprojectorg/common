'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../../collaboration';
import { ProposalEditorAside } from '../../ProposalEditorAside';
import { useVersionPreview } from '../VersionPreviewContext';

/** Show relative time (e.g. "5 minutes ago") for versions newer than 24 hours. */
const RELATIVE_TIME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface ProviderVersion {
  version: number;
  date: number;
  name?: string;
}

interface ProposalVersionsAsideProps {
  onClose: () => void;
  fragmentNames: string[];
}

/**
 * Aside panel for proposal version history.
 * Reads versions directly from the TipTap collaboration provider
 * rather than making a server round-trip.
 */
export function ProposalVersionsAside({
  onClose,
  fragmentNames,
}: ProposalVersionsAsideProps) {
  const locale = useLocale();
  const t = useTranslations();
  const { provider } = useCollaborativeDoc();
  const { previewVersion, startPreview, exitPreview } = useVersionPreview();

  const readVersions = useCallback(
    () => [...provider.getVersions()].sort((a, b) => b.version - a.version),
    [provider],
  );

  const [versions, setVersions] = useState<ProviderVersion[]>(readVersions);

  useEffect(() => {
    const onUpdate = () => setVersions(readVersions());
    provider.watchVersions(onUpdate);
    return () => provider.unwatchVersions(onUpdate);
  }, [provider, readVersions]);

  const handleRestore = () => {
    if (previewVersion === null) {
      return;
    }
    provider.revertToVersion(previewVersion, fragmentNames);
    exitPreview();
  };

  return (
    <ProposalEditorAside
      title={t('Version history')}
      onClose={() => {
        exitPreview();
        onClose();
      }}
      bodyClassName="pt-4"
    >
      {/* Current version indicator */}
      <div className="mx-4 rounded bg-primary-tealWhite p-2">
        <p className="text-base text-neutral-black">{t('Current version')}</p>
        <p className="text-base text-neutral-charcoal">{t('Latest')}</p>
      </div>

      {/* Restore / Keep current actions when previewing */}
      {previewVersion !== null && (
        <div className="mx-4 mt-3 flex gap-2">
          <Button color="secondary" size="small" onPress={exitPreview}>
            Keep current
          </Button>
          <Button color="primary" size="small" onPress={handleRestore}>
            Restore this version
          </Button>
        </div>
      )}

      {/* Version list */}
      <div>
        {versions.map((version) => {
          const createdAt = new Date(version.date).toISOString();
          const isRecent =
            Date.now() - version.date < RELATIVE_TIME_THRESHOLD_MS;
          const isSelected = previewVersion === version.version;

          return (
            <VersionItem
              key={version.version}
              createdAt={createdAt}
              isRecent={isRecent}
              locale={locale}
              isSelected={isSelected}
              onSelect={() => startPreview(version.version)}
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
