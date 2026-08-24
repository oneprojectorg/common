'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { LuArrowDownToLine, LuDownload, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { EXPORT_WAIT_TIMEOUT_MS } from './exportWait';

export interface ExportProposalsButtonProps {
  processInstanceId: string;
  /**
   * Nothing to export. Not the filtered count: the export ignores the list's
   * filters, so a view narrowed to nothing still has rows to hand over.
   *
   * The phase's unfiltered count is the closest signal the list already holds.
   * It is near enough to enable a button, but not an exact preview. The caller's
   * own visibility counts it.
   */
  isEmpty?: boolean;
}

/**
 * Admin-only CSV export of every non-draft proposal in the current phase.
 *
 * It does not follow the list's filters. An export that inherited them produced
 * a different file from the same button, based on state the CSV cannot show.
 *
 * Two admins comparing files then had no way to tell why they differed. Neither
 * could ask for anything wider than their own view.
 *
 * "The current phase" is a real limit, not a turn of phrase. The file is not the
 * instance's whole history. The same button produces a different one once the
 * instance advances.
 *
 * Kick off → wait to be told it finished → hand back a download link.
 *
 * A broadcast on the run's own channel drives the wait, not polling. The file
 * appears as soon as it exists, instead of on the next tick.
 *
 * Offered as an explicit link, not an automatic download. The file is built in
 * the background, so downloading it on arrival would fire a save dialog at an
 * arbitrary moment. That is easy to miss, and impossible to retry without
 * re-running the whole export.
 *
 * The boundary belongs to the component, not to each call site. No call site
 * could usefully decide anything here, because the guarded failure is internal
 * to the wait. A caller that forgot the wrapper would get the misreport
 * described on the status query below.
 */
export const ExportProposalsButton = (props: ExportProposalsButtonProps) => (
  <APIErrorBoundary fallbacks={statusUnreadableFallbacks}>
    <ExportProposalsButtonContent {...props} />
  </APIErrorBoundary>
);

/**
 * Only what the status query escalates reaches this. See its `throwOnError`.
 *
 * Nothing arrives here on its own. A non-suspense `useQuery` reports an error on
 * the result and never throws, so a boundary added without that option would
 * catch nothing.
 *
 * No per-status entries. A 403 looks like the obvious candidate to map to
 * `null`, because the admin lost access and the control should go.
 *
 * But `getExportStatus` also answers 403 when the export id belongs to someone
 * else, which is a bug rather than a permission change. One fallback that says
 * something beats two that hide it.
 */
const statusUnreadableFallbacks = {
  default: ({ error, resetErrorBoundary }: FallbackProps) => (
    <ExportStatusUnreadable error={error} onRetry={resetErrorBoundary} />
  ),
};

/**
 * Shown when the export's status cannot be read at all.
 *
 * Not phrased as a failure. `failed` and the timeout are outcomes the run
 * reported. This is the absence of one.
 *
 * The workflow may still be running, and may still write the file. The client
 * has only lost sight of it. "The export failed" would claim knowledge it does
 * not have.
 *
 * Retrying resets the boundary, which remounts the button at idle. That drops
 * the id of the run in flight.
 *
 * Export state is cache-only with no history, so a file the run goes on to write
 * is unreachable. That cost is real, and the timeout path already pays it.
 */
const ExportStatusUnreadable = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) => {
  const t = useTranslations();

  // Announced by toast, the same way a reported failure is. A live region would
  // compete with it to describe the same event.
  useEffect(() => {
    logger.error('Could not read proposals export status', { error });
    toast.error(
      t("Couldn't check the export's status. It may still be running."),
    );
  }, [error, t]);

  return (
    <Button variant="outline" onClick={onRetry}>
      <LuTriangleAlert aria-hidden />
      {t('Try again')}
    </Button>
  );
};

const ExportProposalsButtonContent = ({
  processInstanceId,
  isEmpty = false,
}: ExportProposalsButtonProps) => {
  const t = useTranslations();
  const [exportId, setExportId] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const startExport = trpc.decision.export.useMutation({
    onSuccess: ({ exportId: id }) => {
      setHasTimedOut(false);
      setExportId(id);
    },
    onError: (error) => {
      logger.error('Failed to start proposals export', { error });
      toast.error(error.message || t('Failed to start export'));
    },
  });

  // No polling. The workflow broadcasts on this export's channel when the run
  // settles, and the subscriber re-reads once the channel is live. That covers
  // an export finishing before the socket join lands.
  const { data: status } = trpc.decision.getExportStatus.useQuery(
    { exportId: exportId ?? '' },
    {
      enabled: Boolean(exportId) && !hasTimedOut,
      // Escalate to the boundary while the run is unresolved. A failed status
      // read is not inert here.
      //
      // `status` stays undefined, so no terminal state matches and `isRunning`
      // stays true. The silence timer below then reports a timeout, which is a
      // claim about the run the client cannot make. Escalating says "we cannot
      // tell" instead.
      //
      // A completed record is exempt. Its signed URL is the only route to the
      // file, because export state is cache-only with no history. Discarding a
      // good link over a failed background refetch would cost the whole run.
      throwOnError: (_error, query) => query.state.data?.status !== 'completed',
    },
  );

  // `not_found` is not a member of ExportStatusData['status'], so matching a
  // terminal state narrows away the not-found branch on its own.
  const isResolved = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isRunning =
    exportId !== null && !isResolved && !isFailed && !hasTimedOut;

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

  // Bounds silence, not duration. The timer restarts whenever the run reports a
  // new state, so it measures how long the export has said nothing.
  //
  // Bounding total elapsed time would abort a healthy run for being large.
  // Generation scales with proposal count, and that ceiling is due to be
  // lifted. It would also wait the full period on a job that died at once.
  const reportedState = status?.status;

  // The run distinguishes accepted-but-not-started from actually-running. One
  // label for both throws that away.
  //
  // They fail differently. A wait stuck on the first means nothing picked the
  // job up, which is a different thing to chase than a slow job.
  //
  // The record can also be missing on an early read. That is still "accepted",
  // so it reads as pending rather than as an error.
  const runningLabel =
    reportedState === 'processing' ? t('Generating...') : t('Preparing...');

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
  }, [isRunning, reportedState, t]);

  if (isResolved && status.signedUrl) {
    return (
      <Button
        variant="outline"
        // Rendered as an anchor so the browser owns the download. Base UI needs
        // both flags to stop emitting button semantics over the link.
        nativeButton={false}
        role={undefined}
        render={
          // Cross-origin, so `download` only names the file.
          // `exportDownloadOptions` is what forces the save.
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
        }}
      >
        <LuDownload aria-hidden />
        {t('Download CSV')}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      // Disabled rather than `loading` once a run is under way. That prop draws
      // a spinner over the label and hides it, so the state the label reports
      // would never be readable.
      //
      // A spinner only says "busy", which being disabled already says. The label
      // says which part is busy. That is the only thing here that separates a
      // job nothing picked up from one that is working.
      //
      // The spinner is kept for the request that starts the run, where there
      // is no state to report yet and nothing to hide.
      disabled={isEmpty || isRunning}
      loading={startExport.isPending}
      // Disabled reads as "unavailable", which is not what a run in progress
      // is — the spinner this replaces carried that meaning on its own. Said
      // explicitly so a screen reader still reports the control as working
      // rather than as switched off. (`loading` sets `aria-busy` itself, but
      // it is deliberately not in use for this state.)
      aria-busy={isRunning}
      onClick={() =>
        startExport.mutate({
          processInstanceId,
          format: 'csv',
        })
      }
    >
      <LuArrowDownToLine aria-hidden />
      {/* Named for what it covers, not for where it sits. The control lives in
          the filter bar and no longer follows it, so a bare "Export" beside an
          active filter would read as exporting that selection. */}
      {isRunning ? runningLabel : t('Export all')}
    </Button>
  );
};
