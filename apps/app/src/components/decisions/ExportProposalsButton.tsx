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
   * Nothing to export. Deliberately not the filtered count: the export ignores
   * the list's filters, so a view narrowed to nothing still has rows to hand
   * over. The phase's unfiltered count is the closest signal the list already
   * holds — near enough to enable a button, though not an exact preview of the
   * row set, since it is counted with the caller's own visibility.
   */
  isEmpty?: boolean;
}

/**
 * Admin-only CSV export of every non-draft proposal in the current phase.
 *
 * It does not follow the list's filters. An export that quietly inherited them
 * produced a different file from the same button depending on state the CSV
 * itself cannot show, so two admins comparing files had no way to tell why
 * they differed — and no way to ask for anything wider than their own view.
 *
 * Note that "the current phase" is a real limit, not a turn of phrase: the file
 * is not the instance's whole history, and the same button will produce a
 * different one once the instance advances.
 *
 * Kick off → wait to be told how it is going and then that it finished → hand
 * back a download link. The wait is driven by broadcasts on the run's own
 * channel rather than by polling, so the label follows the run and the file
 * appears as soon as it exists instead of on the next tick.
 *
 * It is offered as an explicit link rather than an automatic download: the file
 * is built in the background, so downloading it the instant it arrives would
 * fire a save dialog at an arbitrary moment — easy to miss entirely, and
 * impossible to retry without re-running the whole export.
 *
 * The boundary is part of the component rather than left to each call site,
 * because there is nothing a call site could usefully decide here: the failure
 * being guarded is internal to the wait, and a caller that forgot the wrapper
 * would get the misreport described on the status query below.
 */
export const ExportProposalsButton = (props: ExportProposalsButtonProps) => (
  <APIErrorBoundary fallbacks={statusUnreadableFallbacks}>
    <ExportProposalsButtonContent {...props} />
  </APIErrorBoundary>
);

/**
 * Only what the status query escalates reaches this — see its `throwOnError`.
 * Nothing arrives here on its own: a non-suspense `useQuery` reports an error
 * on the result and never throws, so a boundary added without that option
 * would sit here catching nothing.
 *
 * No per-status entries. A 403 is the obvious candidate to map to `null` — the
 * admin lost access, so drop the control — but `getExportStatus` also answers
 * 403 when the export id belongs to someone else, which is a bug rather than a
 * permission change. One fallback that says something beats two that hide it.
 */
const statusUnreadableFallbacks = {
  default: ({ error, resetErrorBoundary }: FallbackProps) => (
    <ExportStatusUnreadable error={error} onRetry={resetErrorBoundary} />
  ),
};

/**
 * Shown when the export's status cannot be read at all.
 *
 * Deliberately not phrased as a failure. `failed` and the timeout are outcomes
 * the run reported; this is the absence of one. The workflow may well still be
 * running and may still write the file — the client has only lost sight of it,
 * and saying "the export failed" would claim knowledge it does not have.
 *
 * Retrying resets the boundary, which remounts the button at idle. That drops
 * the id of the run in flight, and export state is cache-only with no history,
 * so a file it goes on to write is unreachable. That cost is real and already
 * paid by the timeout path; it is not introduced here.
 */
const ExportStatusUnreadable = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) => {
  const t = useTranslations();

  // Announced by toast, the same way a reported failure is, rather than by a
  // live region that would compete with it to describe the same event.
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

  // No polling: the workflow broadcasts on this export's channel when it picks
  // the job up and again when the run settles, and the subscriber re-reads on
  // its own once the channel is live — which is what covers an export reaching
  // either of those before the socket join lands.
  const { data: status } = trpc.decision.getExportStatus.useQuery(
    { exportId: exportId ?? '' },
    {
      enabled: Boolean(exportId) && !hasTimedOut,
      // Escalate to the boundary while the run is unresolved. A failed status
      // read is not inert here: `status` stays undefined, so no terminal state
      // is ever matched, `isRunning` stays true, and the silence timer below
      // ends the wait by reporting a timeout — a claim about the run that the
      // client is in no position to make. Escalating turns "we cannot tell"
      // into something that says so.
      //
      // A completed record is exempt. Its signed URL is the only route to the
      // file — export state is cache-only, with no history to recover it from
      // — so discarding a good link because a later background refetch failed
      // would cost the admin the entire run.
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

  // Bounds silence, not duration: the timer restarts whenever the run reports a
  // new state, so what it measures is how long the export has gone without
  // saying anything. Bounding total elapsed time instead would abort a healthy
  // run purely for being large — generation scales with proposal count, and the
  // ceiling on that is due to be lifted — while still waiting the full period
  // on a job that died a second after starting.
  //
  // The run speaks twice — `processing`, then a terminal state — so in practice
  // this bounds silence since the job started working, and a single generation
  // step that outlasts the period is still cut off.
  const reportedState = status?.status;

  // The run distinguishes accepted-but-not-started from actually-running, and
  // collapsing both into one label throws that away. Kept apart because they
  // fail differently: a wait that stays on the first means the job was never
  // picked up, which is a different thing to chase than one that is slow. The
  // record can also be missing on an early read — that is still "accepted", so
  // it reads the same as pending rather than as an error.
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
      // Disabled rather than `loading` once a run is under way: that prop
      // draws a spinner over the label and renders the label invisible, so the
      // state the label reports would never be readable. A spinner only says
      // "busy", which being disabled already says; the label says which part
      // is busy, and that is the only thing here that distinguishes a job
      // nothing has picked up from one that is genuinely working.
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
