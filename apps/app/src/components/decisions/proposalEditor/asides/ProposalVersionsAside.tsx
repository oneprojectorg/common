'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { cn } from '@op/ui/utils';
import type { THistoryVersion } from '@tiptap-pro/provider';
import { useLocale } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../../collaboration';
import { ProposalEditorAside } from '../../ProposalEditorAside';
import { RestoreProposalVersionModal } from './RestoreProposalVersionModal';

/** Show relative time (e.g. "5 minutes ago") for versions newer than 24 hours. */
const RELATIVE_TIME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface ProposalVersionsAsideProps {
  versionId: number | null;
  onSelectVersion: (versionId: number | null) => void;
  onRestoreVersion: (versionId: number) => void;
  onClose: () => void;
}

/**
 * Aside panel for proposal version history.
 *
 * Reads versions from the TipTap collaboration provider and delegates
 * restore actions to the parent via `onRestoreVersion`.
 */
export function ProposalVersionsAside({
  versionId,
  onSelectVersion,
  onRestoreVersion,
  onClose,
}: ProposalVersionsAsideProps) {
  const locale = useLocale();
  const t = useTranslations();
  const { provider } = useCollaborativeDoc();
  const [isPending, startTransition] = useTransition();

  const readVersions = useCallback(
    () => [...provider.getVersions()].sort((a, b) => b.version - a.version),
    [provider],
  );

  const [versions, setVersions] = useState<THistoryVersion[]>(readVersions);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  useEffect(() => {
    const onUpdate = () => setVersions(readVersions());
    provider.watchVersions(onUpdate);
    return () => provider.unwatchVersions(onUpdate);
  }, [provider, readVersions]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.version === versionId) ?? null,
    [versionId, versions],
  );

  const selectedVersionDate = selectedVersion
    ? new Date(selectedVersion.date).toISOString()
    : null;

  function handleRestore() {
    if (versionId === null) {
      return;
    }

    startTransition(() => {
      onRestoreVersion(versionId);
    });
    setIsRestoreModalOpen(false);
  }

  return (
    <>
      <ProposalEditorAside
        title={t('Version history')}
        onClose={onClose}
        bodyClassName="px-4 pt-4"
      >
        <VersionItem
          label={t('Current version')}
          sublabel={t('Latest')}
          isSelected={versionId === null}
          isPending={isPending}
          onSelect={() => onSelectVersion(null)}
        />

        <>
          {versions.map((version) => (
            <SavedVersionItem
              key={version.version}
              date={version.date}
              locale={locale}
              isSelected={versionId === version.version}
              isPending={isPending}
              onRestore={() => setIsRestoreModalOpen(true)}
              onSelect={() => onSelectVersion(version.version)}
            />
          ))}
        </>
      </ProposalEditorAside>

      {selectedVersion && (
        <RestoreProposalVersionModal
          isOpen={isRestoreModalOpen}
          isPending={isPending}
          versionDate={selectedVersionDate ?? ''}
          onClose={() => setIsRestoreModalOpen(false)}
          onConfirm={handleRestore}
        />
      )}
    </>
  );
}

function VersionItem({
  label,
  sublabel,
  isSelected,
  isPending,
  onRestore,
  onSelect,
}: {
  label: string;
  sublabel: string;
  isSelected: boolean;
  isPending: boolean;
  onRestore?: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded p-2 hover:bg-primary-foreground',
        isSelected && 'bg-primary-foreground',
      )}
    >
      <Button
        unstyled
        onPress={onSelect}
        isDisabled={isPending}
        className="flex w-full flex-col items-start text-left shadow-none outline-hidden focus-visible:outline-none"
      >
        <p className="text-base text-foreground">{label}</p>
        <p className="text-sm text-foreground">{sublabel}</p>
      </Button>
      {isSelected && onRestore && (
        <Button size="small" onPress={onRestore} isDisabled={isPending}>
          {t('Restore this version')}
        </Button>
      )}
    </div>
  );
}

function SavedVersionItem({
  date,
  locale,
  isSelected,
  isPending,
  onRestore,
  onSelect,
}: {
  date: number;
  locale: string;
  isSelected: boolean;
  isPending: boolean;
  onRestore: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const createdAt = new Date(date).toISOString();
  const relativeTime = useRelativeTime(createdAt, { style: 'long' });
  const isRecent = Date.now() - date < RELATIVE_TIME_THRESHOLD_MS;

  const label = isRecent
    ? relativeTime
    : formatDate(createdAt, locale, DATE_TIME_UTC_FORMAT);

  return (
    <VersionItem
      label={label}
      sublabel={t('Auto-saved')}
      isSelected={isSelected}
      isPending={isPending}
      onRestore={onRestore}
      onSelect={onSelect}
    />
  );
}
