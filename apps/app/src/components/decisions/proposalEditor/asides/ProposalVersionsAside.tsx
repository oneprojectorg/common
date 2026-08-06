'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@op/sense/Collapsible';
import { ItemGroup } from '@op/sense/Item';
import { cn } from '@op/sense/lib/utils';
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
  /**
   * Controlled open state. Stays mounted while closed so the sheet can animate
   * out; versions come from the connected collab provider, not a request.
   */
  open: boolean;
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
  open,
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
        open={open}
        title={t('Version history')}
        onClose={onClose}
      >
        <ItemGroup className="gap-2">
          <VersionItem
            label={t('Current version')}
            sublabel={t('Latest')}
            isSelected={versionId === null}
            isPending={isPending}
            onSelect={() => onSelectVersion(null)}
          />

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
        </ItemGroup>
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

/**
 * One row of the history list (Figma 17955:8511), 76px collapsed / 120px with
 * the restore action revealed.
 *
 * Selection drives `open`, so a click always selects — a self-toggling row
 * would collapse while still being previewed. The trigger is the button, not
 * the row: a `<button>` inside a `<button>` swallows the inner one's clicks.
 */
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
    <Collapsible
      open={isSelected}
      render={<div role="listitem" />}
      className={cn(
        'w-full rounded-lg transition-colors',
        isSelected ? 'bg-accent' : 'hover:bg-muted',
      )}
    >
      <CollapsibleTrigger
        // `bare` + `none`: own look, but keep the focus ring and disabled
        // handling a raw `<button>` would drop.
        render={
          <Button
            variant="bare"
            size="none"
            onClick={onSelect}
            disabled={isPending}
            aria-current={isSelected ? 'true' : undefined}
          />
        }
        className={cn(
          'flex w-full flex-col items-start gap-0.5 rounded-lg px-4 pt-4 text-start',
          // 16px collapsed, 12px expanded — Figma's 76 / 120.
          isSelected ? 'pb-3' : 'pb-4',
        )}
      >
        <span className="text-base font-strong text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">{sublabel}</span>
      </CollapsibleTrigger>

      {onRestore && (
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <div className="px-4 pb-4">
            <Button size="sm" onClick={onRestore} disabled={isPending}>
              {t('Restore this version')}
            </Button>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
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
      sublabel={t('Auto saved')}
      isSelected={isSelected}
      isPending={isPending}
      onRestore={onRestore}
      onSelect={onSelect}
    />
  );
}
