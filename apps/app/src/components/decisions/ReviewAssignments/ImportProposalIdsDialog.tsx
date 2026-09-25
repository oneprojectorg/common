'use client';

import { trpc } from '@op/api/client';
import type { AssignableProposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Textarea } from '@op/sense/Textarea';
import { useEffect, useId, useMemo, useState } from 'react';
import { LuClipboardPaste } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { rowKindOf } from './assignableRowKind';
import { summarizeProposalIdImport } from './proposalIdImport';

interface ImportProposalIdsDialogProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  /** Merged into the parent's selection, additively. */
  onImport: (proposalIds: Array<string>) => void;
}

interface ImportProposalIdsFormProps extends ImportProposalIdsDialogProps {
  onClose: () => void;
}

const IMPORT_POOL_PAGE_LIMIT = 100;

const EMPTY_POOL_ROWS: AssignableProposal[] = [];

/**
 * Paste-a-spreadsheet shortcut for `ManageAssignmentsForm`, stacked on top
 * of it: admins triage in Sheets and arrive with 100+ proposal IDs, which is
 * not a checkbox job. Import only adds to the parent's selection — the admin
 * still reviews the rows and presses save, so nothing here mutates. The
 * phase's proposals load only once the dialog opens.
 */
export function ImportProposalIdsDialog(props: ImportProposalIdsDialogProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        {/* Clipboard rather than an upload glyph: this opens a paste box, and a
            file icon would promise a file picker that isn't there. */}
        <LuClipboardPaste data-icon="inline-start" />
        {t('decisions.review.importAction')}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {/* Hooks stay in this child: the portal defers it to open, and unmount
            resets the paste — a stale one would be re-read against a reviewer
            the admin has since changed. */}
        <ImportProposalIdsForm {...props} onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Pages the whole pool: "not found" is a claim about the whole phase. */
function ImportProposalIdsForm({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  onImport,
  onClose,
}: ImportProposalIdsFormProps) {
  const t = useTranslations();
  const pasteId = useId();
  const pasteDescriptionId = `${pasteId}-description`;
  const [pastedText, setPastedText] = useState('');

  const poolQuery = trpc.decision.listAssignableProposals.useInfiniteQuery(
    {
      processInstanceId,
      phaseId,
      reviewerProfileId,
      limit: IMPORT_POOL_PAGE_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      staleTime: 30 * 1000,
    },
  );

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = poolQuery;
  // A failed page keeps hasNextPage true; without the error guard this refetches forever.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  // A retry keeps `isError` until it succeeds, so it reads as loading meanwhile.
  const isPoolFailed = isError && !poolQuery.isFetching;
  // Until the last page lands, a live ID from an unloaded page would read as "not found".
  const isPoolReady = !isError && !poolQuery.isPending && !hasNextPage;

  const rows = useMemo(
    () =>
      poolQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_POOL_ROWS,
    [poolQuery.data?.pages],
  );

  // Sets, not lists: the spreadsheet import looks IDs up by membership.
  const poolIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const assignableIds = useMemo(
    () =>
      new Set(
        rows.flatMap((row) => (rowKindOf(row) === 'free' ? [row.id] : [])),
      ),
    [rows],
  );

  const summary = useMemo(
    () => summarizeProposalIdImport({ pastedText, poolIds, assignableIds }),
    [pastedText, poolIds, assignableIds],
  );

  const hasPaste = pastedText.trim().length > 0;

  // Every extracted ID lands in exactly one bucket, so the three counts add up
  // to what the scan found. "No IDs" is about the scan, not about the match:
  // keying it off `matchedIds` would contradict the "N not found" line below.
  const extractedCount =
    summary.matchedIds.length + summary.notFoundCount + summary.skippedCount;
  const foundNoIds = hasPaste && extractedCount === 0;

  // Only the non-zero halves get a line: a "0 skipped" is noise, and each half
  // has to pluralize on its own count, so they are two messages, not one.
  const rejectedParts = [
    summary.notFoundCount > 0
      ? t('decisions.review.importIdsNotFoundCount', {
          count: summary.notFoundCount,
        })
      : null,
    summary.skippedCount > 0
      ? t('decisions.review.importProposalsSkippedCount', {
          count: summary.skippedCount,
        })
      : null,
  ].filter((part) => part !== null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t('decisions.review.importProposalIdsTitle')}
        </DialogTitle>
        <DialogDescription>
          {t('decisions.review.importPasteHint')}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 px-6 py-4">
        <Field>
          <FieldLabel htmlFor={pasteId}>
            {t('decisions.review.importPasteLabel')}
          </FieldLabel>
          {/* `field-sizing-content` grows the box with the paste, and a
              spreadsheet column is long enough to swallow the dialog
              underneath — the stacking cue that tells the admin where they
              are. Cap it and scroll instead. */}
          <Textarea
            id={pasteId}
            aria-describedby={pasteDescriptionId}
            className="max-h-48 min-h-32 resize-none overflow-y-auto"
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            placeholder={t('decisions.review.importPastePlaceholder')}
          />
          {/* Updates on every keystroke with no navigation, so it is a live
              region — and the same text a sighted admin reads. */}
          <FieldDescription id={pasteDescriptionId} aria-live="polite">
            {isPoolFailed ? (
              t('decisions.review.importPoolLoadError')
            ) : !isPoolReady ? (
              t('decisions.review.importPoolLoading')
            ) : hasPaste ? (
              <>
                {/* A zero match still leads with "0 proposals matched": it
                    states what the import will do, which is what the
                    disabled Add button leaves unsaid. */}
                <span className="block">
                  {foundNoIds
                    ? t('decisions.review.importNoIdsFound')
                    : t('decisions.review.importProposalsMatchedCount', {
                        count: summary.matchedIds.length,
                      })}
                </span>
                {rejectedParts.length > 0 ? (
                  <span className="block">{rejectedParts.join(' · ')}</span>
                ) : null}
              </>
            ) : null}
          </FieldDescription>
        </Field>
        {isPoolFailed ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              void poolQuery.refetch();
            }}
          >
            {t('Try again')}
          </Button>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t('Cancel')}
        </DialogClose>
        <Button
          disabled={!isPoolReady || summary.matchedIds.length === 0}
          onClick={() => {
            onImport(summary.matchedIds);
            onClose();
          }}
        >
          {t('decisions.review.addToSelectionAction')}
        </Button>
      </DialogFooter>
    </>
  );
}
