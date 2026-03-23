'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { normalizeBudget, parseProposalData } from '@op/common/client';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import type { THistoryVersion } from '@tiptap-pro/provider';
import type { JSONContent } from '@tiptap/react';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../../collaboration';
import { ProposalEditorAside } from '../../ProposalEditorAside';
import { useOptionalVersionPreview } from '../VersionPreviewContext';
import { RestoreProposalVersionModal } from './RestoreProposalVersionModal';

/** Show relative time (e.g. "5 minutes ago") for versions newer than 24 hours. */
const RELATIVE_TIME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface ProposalVersionsAsideProps {
  proposalId: string;
  proposalData: unknown;
  proposalTitle: string;
  fragmentNames: string[];
  versionId: number | null;
  onSelectVersion: (versionId: number | null) => void;
  onClose: () => void;
}

/**
 * Aside panel for proposal version history.
 * Reads versions directly from the TipTap collaboration provider.
 */
export function ProposalVersionsAside({
  proposalId,
  proposalData,
  proposalTitle,
  fragmentNames,
  versionId,
  onSelectVersion,
  onClose,
}: ProposalVersionsAsideProps) {
  const locale = useLocale();
  const t = useTranslations();
  const { provider } = useCollaborativeDoc();
  const utils = trpc.useUtils();
  const versionPreview = useOptionalVersionPreview();

  const readVersions = useCallback(
    () => [...provider.getVersions()].sort((a, b) => b.version - a.version),
    [provider],
  );

  const [versions, setVersions] = useState<THistoryVersion[]>(readVersions);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => {
      toast.error({
        title: t('Failed to restore proposal version'),
        message: error.message || t('An unexpected error occurred'),
      });
    },
  });

  useEffect(() => {
    const onUpdate = () => setVersions(readVersions());
    provider.watchVersions(onUpdate);
    return () => provider.unwatchVersions(onUpdate);
  }, [provider, readVersions]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.version === versionId) ?? null,
    [versionId, versions],
  );

  const isSelectedVersionPreviewReady =
    selectedVersion !== null &&
    versionPreview?.tiptapVersion?.version === selectedVersion.version &&
    Object.keys(versionPreview?.fragmentContents ?? {}).length > 0;
  const selectedVersionDate = selectedVersion
    ? new Date(selectedVersion.date).toISOString()
    : null;

  const handleRestore = useCallback(async () => {
    if (!selectedVersion || !versionPreview || !isSelectedVersionPreviewReady) {
      return;
    }

    const currentProposalData = parseProposalData(proposalData);
    const nextTitle =
      getPlainTextContent(versionPreview.fragmentContents.title) ||
      proposalTitle;
    const nextCategory =
      getPlainTextContent(versionPreview.fragmentContents.category) ||
      undefined;
    const nextBudget = normalizePreviewBudget(
      versionPreview.fragmentContents.budget,
    );

    provider.revertToVersion(selectedVersion.version, fragmentNames);

    await updateProposalMutation.mutateAsync({
      proposalId,
      data: {
        title: nextTitle,
        proposalData: {
          ...currentProposalData,
          collaborationDocId: currentProposalData.collaborationDocId,
          category: nextCategory,
          budget: nextBudget,
        },
      },
    });

    await Promise.all([
      utils.decision.getProposal.invalidate(),
      utils.decision.listProposals.invalidate(),
    ]);

    setIsRestoreModalOpen(false);
    onSelectVersion(null);
    toast.success({
      message: t('Proposal version restored'),
    });
  }, [
    fragmentNames,
    isSelectedVersionPreviewReady,
    onSelectVersion,
    proposalId,
    proposalData,
    proposalTitle,
    provider,
    selectedVersion,
    t,
    updateProposalMutation,
    utils.decision.getProposal,
    utils.decision.listProposals,
    versionPreview,
  ]);

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
                canRestore={isSelectedVersionPreviewReady}
                isPending={updateProposalMutation.isPending}
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
          isPending={updateProposalMutation.isPending}
          versionDate={selectedVersionDate ?? ''}
          onClose={() => setIsRestoreModalOpen(false)}
          onConfirm={() => void handleRestore()}
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

function getPlainTextContent(content: JSONContent | null | undefined): string {
  if (!content) {
    return '';
  }

  if (typeof content.text === 'string') {
    return content.text;
  }

  if (!Array.isArray(content.content)) {
    return '';
  }

  return content.content.map((child) => getPlainTextContent(child)).join('');
}

function normalizePreviewBudget(content: JSONContent | null | undefined) {
  const raw = getPlainTextContent(content);

  if (!raw) {
    return undefined;
  }

  try {
    return normalizeBudget(JSON.parse(raw));
  } catch {
    return normalizeBudget(raw);
  }
}
