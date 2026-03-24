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
  canRestore: boolean;
  onSelectVersion: (versionId: number | null) => void;
  onRestoreVersion: (versionId: number) => void;
  onClose: () => void;
}

/**
 * Aside panel for proposal version history.
 *
 * Pure presentation component — reads versions from the TipTap collaboration
 * provider and delegates restore actions to the parent via `onRestoreVersion`.
 */
export function ProposalVersionsAside({
  versionId,
  canRestore,
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
        <Button
          unstyled
          onPress={() => onSelectVersion(null)}
          className={cn(
            'flex w-full flex-col items-start rounded p-2 text-left shadow-none outline-hidden focus-visible:outline-none',
            versionId === null
              ? 'bg-primary-tealWhite'
              : 'hover:bg-neutral-offWhite',
          )}
        >
          <p className="text-base text-neutral-black">{t('Current version')}</p>
          <p className="text-base text-neutral-charcoal">{t('Latest')}</p>
        </Button>

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
                canRestore={canRestore}
                isPending={isPending}
                onRestore={() => setIsRestoreModalOpen(true)}
                onSelect={() => onSelectVersion(version.version)}
              />
            );
          })}
        </div>
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
  createdAt,
  isRecent,
  locale,
  isSelected,
  canRestore,
  isPending,
  onRestore,
  onSelect,
}: {
  createdAt: string;
  isRecent: boolean;
  locale: string;
  isSelected: boolean;
  canRestore: boolean;
  isPending: boolean;
  onRestore: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const relativeTime = useRelativeTime(createdAt, { style: 'long' });

  const label = isRecent
    ? relativeTime
    : formatDate(createdAt, locale, DATE_TIME_UTC_FORMAT);

  return (
    <div
      className={cn(
        'w-full rounded',
        isSelected ? 'bg-primary-tealWhite' : 'hover:bg-neutral-offWhite',
      )}
    >
      <Button
        unstyled
        onPress={onSelect}
        isDisabled={isPending}
        className="flex w-full flex-col items-start rounded p-2 text-left shadow-none outline-hidden focus-visible:outline-none"
      >
        <p className="text-base text-neutral-black">{label}</p>
        <p className="text-sm text-neutral-charcoal">{t('Auto-saved')}</p>
      </Button>
      {isSelected && (
        <Button
          className="mx-2 mb-2"
          size="small"
          onPress={onRestore}
          isDisabled={isPending || !canRestore}
        >
          {t('Restore this version')}
        </Button>
      )}
    </div>
  );
}
