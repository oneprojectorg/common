'use client';

import { trpc } from '@op/api/client';
import type { ProposalExportFilters } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuDownload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { EXPORT_WAIT_TIMEOUT_MS } from './exportWait';

export interface ExportProposalsButtonProps {
  processInstanceId: string;
  /**
   * The filters currently applied to the list. These are the list's own
   * resolved query params — not its filter-tab identity — so the export
   * reproduces the same server-side query and the CSV matches what the admin is
   * looking at, rather than silently exporting the whole instance.
   *
   * Taken from the shared schema rather than restated here: it is the one
   * definition the event payload, the request input, and the status response
   * all derive from, and a fourth hand-written copy is how a newly added filter
   * ends up silently not forwarded.
   */
  filters: ProposalExportFilters;
  /** Nothing to export — the list is empty under the active filter. */
  isEmpty?: boolean;
}

/**
 * Admin-only CSV export for the proposals list.
 *
 * Kick off → wait to be told it finished → hand back a download link. The wait
 * is driven by a broadcast on the run's own channel rather than by polling, so
 * the file appears as soon as it exists instead of on the next tick.
 *
 * It is offered as an explicit link rather than an automatic download: the file
 * is built in the background, so downloading it the instant it arrives would
 * fire a save dialog at an arbitrary moment — easy to miss entirely, and
 * impossible to retry without re-running the whole export.
 */
export const ExportProposalsButton = ({
  processInstanceId,
  filters,
  isEmpty = false,
}: ExportProposalsButtonProps) => {
  const t = useTranslations();
  const [exportId, setExportId] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Identity of the filter set this export was started from. When the admin
  // changes filters the finished file no longer describes what is on screen, so
  // the stale link is cleared rather than left to be downloaded by mistake.
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const startedFilterKey = useRef<string | null>(null);

  const startExport = trpc.decision.export.useMutation({
    onSuccess: ({ exportId: id }) => {
      startedFilterKey.current = filterKey;
      setHasTimedOut(false);
      setExportId(id);
    },
    onError: (error) => {
      logger.error('Failed to start proposals export', { error });
      toast.error(error.message || t('Failed to start export'));
    },
  });

  // No polling: the workflow broadcasts on this export's channel when the run
  // settles, and the subscriber re-reads on its own once the channel is live —
  // which is what covers an export finishing before the socket join lands.
  const { data: status } = trpc.decision.getExportStatus.useQuery(
    { exportId: exportId ?? '' },
    { enabled: Boolean(exportId) && !hasTimedOut },
  );

  // `not_found` is not a member of ExportStatusData['status'], so matching a
  // terminal state narrows away the not-found branch on its own.
  const isResolved = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isStale = exportId !== null && startedFilterKey.current !== filterKey;
  const isRunning =
    exportId !== null && !isResolved && !isFailed && !hasTimedOut && !isStale;

  // Drop a completed link once it no longer matches the visible filters.
  useEffect(() => {
    if (isStale) {
      setExportId(null);
      setHasTimedOut(false);
      startedFilterKey.current = null;
    }
  }, [isStale]);

  // Surface a failed workflow once, then return the button to its idle state so
  // the admin can retry.
  useEffect(() => {
    if (!isFailed) {
      return;
    }
    const message =
      status && 'errorMessage' in status ? status.errorMessage : undefined;
    logger.error('Proposals export failed', { error: message });
    toast.error(message || t('Export failed'));
    setExportId(null);
  }, [isFailed, status, t]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const timer = setTimeout(() => {
      setHasTimedOut(true);
      toast.error(t('Export timed out. Please try again.'));
      setExportId(null);
    }, EXPORT_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isRunning, t]);

  if (isResolved && status.signedUrl) {
    return (
      <Button
        variant="secondary"
        size="sm"
        // Rendered as an anchor so the browser owns the download. Base UI needs
        // both flags to stop emitting button semantics over the link.
        nativeButton={false}
        role={undefined}
        render={
          <a
            href={status.signedUrl}
            download={status.fileName}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
        onClick={() => {
          // One file per run: once taken, fall back to the idle button so a
          // later export is not confused with this one.
          setExportId(null);
          startedFilterKey.current = null;
        }}
      >
        <LuDownload aria-hidden />
        {t('Download CSV')}
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isEmpty}
      loading={isRunning || startExport.isPending}
      onClick={() =>
        startExport.mutate({
          processInstanceId,
          format: 'csv',
          ...filters,
        })
      }
    >
      <LuDownload aria-hidden />
      {isRunning ? t('Exporting...') : t('Export')}
    </Button>
  );
};
