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

import { ButtonLink } from '@/components/ButtonLink';

import { resolveExportRetryOutcome } from './exportRetry';
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
 * React component for the admin-only CSV export of every non-draft proposal in
 * the current phase. This is the entry point the decision pages render.
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
 * Kick off → wait to be told how it is going and then that it finished → hand
 * back a download link.
 *
 * Broadcasts on the run's own channel drive the wait, not polling. The label
 * follows the run, and the file appears as soon as it exists, instead of on the
 * next tick.
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
 *
 * @param props - See {@link ExportProposalsButtonProps}. Passed through to
 *   {@link ExportProposalsButtonContent}, which holds the run's state, so a
 *   boundary reset remounts it at idle.
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
 * React component for the error-boundary fallback, shown when the export's
 * status cannot be read at all.
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
 *
 * @param error - What the status query escalated. Logged, not shown: it names a
 *   cause the admin cannot act on.
 * @param onRetry - Resets the error boundary, which remounts the button at idle.
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

/**
 * React component for the settled state of an export: the download link, or a
 * retry control when the server could not sign a URL.
 *
 * {@link ExportProposalsButtonContent} renders this once the status query
 * reports `completed`, and `signedUrl` alone decides which of the two controls
 * appears. Both render behind one polite live region, because an export settles
 * without a navigation and settling swaps the control for a different element.
 *
 * The download is a `ButtonLink` rather than a button with a click handler, so
 * the browser owns the transfer and a screen reader announces a link. Taking it
 * calls `onTaken`, which retires the export id: one file per run.
 *
 * A completed export with no URL is a real state, not a defect. The run
 * succeeded and the object remains in the bucket, and only the signature is
 * missing, so the server reports a completed export without a URL instead of a
 * failure. Re-reading the record is the whole recovery, which is what `onRetry`
 * does. A fall through to the idle button would leave the admin with no download
 * and no stated reason.
 *
 * @param signedUrl - Signed download URL from the record. Absent when signing
 *   failed, which is what selects the retry control.
 * @param fileName - Name the browser saves the CSV under. These links are
 *   cross-origin, so this only names the file; `exportDownloadOptions` on the
 *   signed URL is what forces the save.
 * @param isRetrying - A re-read is in flight. Disables the retry control and
 *   swaps its label for "Preparing...".
 * @param onRetry - Re-reads the export record. Runs on a retry click.
 * @param onTaken - Retires the export id. Runs once the admin takes the
 *   download.
 */
const CompletedExportAction = ({
  signedUrl,
  fileName,
  isRetrying,
  onRetry,
  onTaken,
}: {
  signedUrl?: string;
  fileName?: string;
  isRetrying: boolean;
  onRetry: () => void | Promise<void>;
  onTaken: () => void;
}) => {
  const t = useTranslations();

  // The export settles without a navigation. Settling also swaps this control
  // for a different element, so a screen reader that follows the button gets no
  // reason to look again. This region announces both settled states, so the two
  // branches below do not each need one.
  const settledAnnouncement = signedUrl
    ? t('Export ready')
    : t('Could not prepare the download. Please try again.');

  const announcement = (
    <span role="status" aria-live="polite" className="sr-only">
      {settledAnnouncement}
    </span>
  );

  if (!signedUrl) {
    return (
      <>
        {announcement}
        <Button
          variant="outline"
          onClick={() => {
            void onRetry();
          }}
          disabled={isRetrying}
          // The idle button below sets this for the same reason. A screen
          // reader reports `disabled` on its own as "unavailable", and a retry
          // in flight is not unavailable.
          aria-busy={isRetrying}
        >
          <LuDownload aria-hidden />
          {isRetrying ? t('Preparing...') : t('Retry download')}
        </Button>
      </>
    );
  }

  return (
    <>
      {announcement}
      {/* A link, not a button: the browser owns the download. `ButtonLink`
          carries the base-ui flags that keep it announced as a link. */}
      <ButtonLink
        variant="outline"
        // Cross-origin, so `download` only names the file.
        // `exportDownloadOptions` is what forces the save.
        href={signedUrl}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onTaken}
      >
        <LuDownload aria-hidden />
        {t('Download CSV')}
      </ButtonLink>
    </>
  );
};

/**
 * React component holding everything about one export run: the mutation that
 * starts it, the status query that follows it, the silence timeout that bounds
 * it, and the control for each state.
 *
 * `exportId` is the state that drives all of it. Setting it enables the status
 * query, and clearing it returns the button to idle. Because export state is
 * cache-only, that id is the only handle on a finished run, so every path that
 * clears it is deliberate: the admin took the download, the run failed, the wait
 * timed out, or the record aged out of the cache.
 *
 * This sits behind {@link ExportProposalsButton}'s error boundary rather than
 * being exported, so a reset remounts it and discards that state.
 *
 * @param processInstanceId - Decision instance whose current phase is exported.
 * @param isEmpty - The phase holds no proposals, so the button stays disabled.
 *   See {@link ExportProposalsButtonProps} for why this is not the filtered
 *   count.
 */
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

  // No polling. The workflow broadcasts on this export's channel when it picks
  // the job up and again when the run settles, and the subscriber re-reads once
  // the channel is live. That covers an export reaching either of those before
  // the socket join lands.
  const {
    data: status,
    refetch: refetchStatus,
    isFetching: isFetchingStatus,
  } = trpc.decision.getExportStatus.useQuery(
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
      // The provider disables retries globally, which would make a single
      // dropped request terminal: it escalates to the boundary, the button
      // remounts at idle, and `exportId` goes with it — so a run that is still
      // working writes a file nothing can reach. A blip is not the "we cannot
      // tell" the escalation above is for, so absorb it first.
      retry: 2,
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
  //
  // How much that buys depends on the run reporting a state the client has not
  // already seen. It reports two, but the first read often lands after the
  // workflow has written `processing`, in which case there is one arm rather
  // than two and this is still a bound on the whole run. A single generation
  // step that outlasts the period is cut off either way.
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

  // `throwOnError` above stops escalating once a record is `completed`. A
  // failed retry therefore lands here instead of on the error boundary. This
  // handler must report it, or the button looks like it did nothing.
  const handleRetryDownload = async () => {
    const { data, error } = await refetchStatus();
    const outcome = resolveExportRetryOutcome({
      errored: Boolean(error),
      status: data?.status,
      signedUrl: data && 'signedUrl' in data ? data.signedUrl : undefined,
    });

    if (outcome === 'recovered' || outcome === 'failure-already-reported') {
      return;
    }

    toast.error(t('Could not prepare the download. Please try again.'));

    if (outcome === 'record-gone') {
      setExportId(null);
    }
  };

  if (isResolved) {
    const completedAction = (
      <CompletedExportAction
        signedUrl={status.signedUrl}
        fileName={status.fileName}
        isRetrying={isFetchingStatus}
        onRetry={handleRetryDownload}
        // Each run produces one file. Once the admin takes it, the control
        // returns to idle, so a later export cannot be confused with this one.
        onTaken={() => setExportId(null)}
      />
    );

    // Both counts are required, not defaulted: the workflow writes them in the
    // same update that sets `truncated`, so their absence means a record from
    // before this shipped. "Only 0 of 0 proposals" would be a worse answer than
    // staying quiet, and `?? 0` is how that gets rendered.
    const { rowCount, total } = status;

    if (status.truncated && rowCount != null && total != null) {
      return (
        <div className="flex flex-col items-start gap-1">
          {completedAction}
          <ExportTruncationNotice rowCount={rowCount} total={total} />
        </div>
      );
    }

    return completedAction;
  }

  return (
    <>
      {/* Disabling the button that started the run takes focus with it, and
          nothing reads the control again afterwards, so the label moving from
          "Preparing..." to "Generating..." would otherwise be silent for a
          screen reader. (The button stays in the accessibility tree while
          disabled — it is focus, not exposure, that is lost.) Announced from
          here instead. */}
      <span role="status" aria-live="polite" className="sr-only">
        {isRunning ? runningLabel : ''}
      </span>
      <Button
        variant="outline"
        // Disabled rather than `loading` once a run is under way. That prop
        // draws a spinner over the label and hides it, so the state the label
        // reports would never be readable.
        //
        // A spinner only says "busy", which being disabled already says. The
        // label says which part is busy. That is the only thing here that
        // separates a job nothing picked up from one that is working.
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
    </>
  );
};

/**
 * Says that a completed export is short of the instance's row count.
 *
 * A truncated export is the one case where the file cannot speak for itself: it
 * is well-formed, it reports success, and nothing in it marks where the rows
 * stop. Rendered beside the download rather than raised as a toast, because a
 * toast is gone by the time the admin opens the CSV and it is the person
 * holding the file who needs to know it is incomplete.
 */
const ExportTruncationNotice = ({
  rowCount,
  total,
}: {
  rowCount: number;
  total: number;
}) => {
  const t = useTranslations();

  return (
    <p
      className="flex items-center gap-1 text-label text-warning-muted-foreground"
      // Appears when the run settles, with no navigation to announce it.
      aria-live="polite"
    >
      <LuTriangleAlert aria-hidden />
      {t('Only {rowCount} of {total} proposals are in this file.', {
        rowCount,
        total,
      })}
    </p>
  );
};
