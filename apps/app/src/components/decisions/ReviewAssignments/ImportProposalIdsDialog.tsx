'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Textarea } from '@op/sense/Textarea';
import { useId, useMemo, useState } from 'react';
import { LuClipboardPaste } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { summarizeProposalIdImport } from './proposalIdImport';

/**
 * Paste-a-spreadsheet shortcut for `ManageAssignmentsDialog`, stacked on top
 * of it: admins triage in Sheets and arrive with 100+ proposal IDs, which is
 * not a checkbox job. Import only adds to the parent's selection — the admin
 * still reviews the rows and presses save, so nothing here mutates.
 */
export function ImportProposalIdsDialog({
  poolIds,
  assignableIds,
  onImport,
  disabled = false,
}: {
  /** Every proposal in the phase — an ID outside it is "not found". */
  poolIds: ReadonlySet<string>;
  /** Proposals with no blocker for the reviewer — the importable set. */
  assignableIds: ReadonlySet<string>;
  /** Merged into the parent's selection, additively. */
  onImport: (proposalIds: Array<string>) => void;
  /**
   * Held closed while the pool is still loading: an incomplete `poolIds` would
   * report a live proposal as "not found".
   */
  disabled?: boolean;
}) {
  const t = useTranslations();
  const pasteId = useId();
  const pasteDescriptionId = `${pasteId}-description`;
  const [isOpen, setIsOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');

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
      ? t('{count, plural, one {# ID not found} other {# IDs not found}}', {
          count: summary.notFoundCount,
        })
      : null,
    summary.skippedCount > 0
      ? t(
          "{count, plural, one {# proposal skipped (already assigned or the reviewer's own)} other {# proposals skipped (already assigned or the reviewer's own)}}",
          { count: summary.skippedCount },
        )
      : null,
  ].filter((part) => part !== null);

  // Each open starts from a blank sheet; a stale paste would otherwise be
  // re-read against a reviewer the admin has since changed.
  const close = () => {
    setIsOpen(false);
    setPastedText('');
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setIsOpen(true);
        } else {
          close();
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        {/* Clipboard rather than an upload glyph: this opens a paste box, and a
            file icon would promise a file picker that isn't there. */}
        <LuClipboardPaste data-icon="inline-start" />
        {t('Import')}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Import proposal IDs')}</DialogTitle>
          <DialogDescription>
            {t(
              'Paste anything you copied from your spreadsheet. We pick out the proposal IDs and ignore the rest.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <Field>
            <FieldLabel htmlFor={pasteId}>
              {t('Pasted spreadsheet content')}
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
              placeholder={t('Paste a column of proposal IDs, or whole rows')}
            />
            {/* Updates on every keystroke with no navigation, so it is a live
                region — and the same text a sighted admin reads. */}
            <FieldDescription id={pasteDescriptionId} aria-live="polite">
              {hasPaste ? (
                <>
                  {/* A zero match still leads with "0 proposals matched": it
                      states what the import will do, which is what the
                      disabled Add button leaves unsaid. */}
                  <span className="block">
                    {foundNoIds
                      ? t('No proposal IDs found in what you pasted.')
                      : t(
                          '{count, plural, one {# proposal matched} other {# proposals matched}}',
                          { count: summary.matchedIds.length },
                        )}
                  </span>
                  {rejectedParts.length > 0 ? (
                    <span className="block">{rejectedParts.join(' · ')}</span>
                  ) : null}
                </>
              ) : null}
            </FieldDescription>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={summary.matchedIds.length === 0}
            onClick={() => {
              onImport(summary.matchedIds);
              close();
            }}
          >
            {t('Add to selection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
