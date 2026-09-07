'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { THEME_ANALYSIS_MIN_PROPOSALS } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useEffect } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { LuSparkles, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ThemeAnalysisDialog } from './ThemeAnalysisDialog';
import { useThemeAnalysisRun } from './useThemeAnalysisRun';

export interface ThemeAnalysisButtonProps {
  processInstanceId: string;
  /**
   * Proposals in the phase, unfiltered. The analysis ignores the list's
   * filters, so a view narrowed to nothing still has a corpus to read — this is
   * the phase's own count, which is what the server checks against.
   */
  proposalCount: number;
}

/**
 * React component for the admin-only theme analysis of a decision phase.
 *
 * Kick off → wait to be told how it is going and then that it finished → open a
 * dialog with what it found.
 *
 * Like the export beside it, this covers the phase rather than the list: the
 * filters on screen do not narrow it, so two facilitators analysing the same
 * instance are reading a synthesis of the same corpus. "The current phase" is a
 * real limit — the analysis is not the instance's history, and the same button
 * produces a different one once the instance advances.
 *
 * Broadcasts on the run's own channel drive the wait, not polling, so the label
 * follows the run and the dialog opens as soon as there is something in it.
 *
 * The boundary belongs to the component rather than to each call site. No call
 * site could usefully decide anything about a failed status read, because the
 * failure is internal to the wait.
 *
 * @param props - See {@link ThemeAnalysisButtonProps}. Passed through to
 *   {@link ThemeAnalysisButtonContent}, which holds the run's state, so a
 *   boundary reset remounts it at idle.
 */
export const ThemeAnalysisButton = (props: ThemeAnalysisButtonProps) => (
  <APIErrorBoundary fallbacks={statusUnreadableFallbacks}>
    <ThemeAnalysisButtonContent {...props} />
  </APIErrorBoundary>
);

/**
 * Only what the status query escalates reaches this. See its `throwOnError`.
 *
 * Nothing arrives here on its own: a non-suspense `useQuery` reports an error on
 * the result and never throws, so a boundary added without that option would
 * catch nothing.
 *
 * One fallback rather than per-status entries. A 403 looks like the obvious
 * candidate to map to `null` — the admin lost access, so the control should go —
 * but `getThemeAnalysisStatus` also answers 403 when the analysis id belongs to
 * someone else, which is a bug rather than a permission change.
 */
const statusUnreadableFallbacks = {
  default: ({ error, resetErrorBoundary }: FallbackProps) => (
    <ThemeAnalysisUnreadable error={error} onRetry={resetErrorBoundary} />
  ),
};

/**
 * React component for the error-boundary fallback, shown when the analysis's
 * status cannot be read at all.
 *
 * Not phrased as a failure. `failed` and the timeout are outcomes the run
 * reported; this is the absence of one. The workflow may still be running, and
 * the client has only lost sight of it, so "the analysis failed" would claim
 * knowledge it does not have.
 *
 * @param error - What the status query escalated. Logged, not shown: it names a
 *   cause the facilitator cannot act on.
 * @param onRetry - Resets the error boundary, which remounts the button at idle.
 */
const ThemeAnalysisUnreadable = ({
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
    logger.error('Could not read theme analysis status', { error });
    toast.error(
      t("Couldn't check the analysis's status. It may still be running."),
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
 * React component for the control itself, plus the dialog its run ends in.
 *
 * The run's state lives in {@link useThemeAnalysisRun}, so what is left here is
 * what a control is for: whether it can be pressed, what it says, and what it
 * announces. This component holds no state of its own — the dialog is open for
 * exactly as long as there is a result, and closing it ends the run.
 *
 * Sits behind {@link ThemeAnalysisButton}'s error boundary rather than being
 * exported, so a reset remounts it and discards the run.
 *
 * @param processInstanceId - Decision instance whose current phase is analysed.
 * @param proposalCount - The phase's unfiltered proposal count, which decides
 *   whether there is anything to compare.
 */
const ThemeAnalysisButtonContent = ({
  processInstanceId,
  proposalCount,
}: ThemeAnalysisButtonProps) => {
  const t = useTranslations();
  const { isStarting, isRunning, runningLabel, completed, start, retire } =
    useThemeAnalysisRun(processInstanceId);

  // Closing ends the run. Each press produces one analysis, and holding on to it
  // would leave a later run indistinguishable from this one.
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      retire();
    }
  };

  // The same number the request service refuses below, taken from the one
  // definition rather than mirrored: an enabled button whose only possible
  // outcome is a validation error is an action we should not have offered.
  const hasEnoughProposals = proposalCount >= THEME_ANALYSIS_MIN_PROPOSALS;

  return (
    <>
      {/* Disabling the button that started the run takes focus with it, and
          nothing reads the control again afterwards, so the label moving from
          "Preparing..." to "Analyzing..." would otherwise be silent for a
          screen reader. Announced from here instead. */}
      {/* `runningLabel` is null when idle, which React renders as nothing — the
          region stays empty and announces on the next label rather than on
          mount. */}
      <span role="status" aria-live="polite" className="sr-only">
        {runningLabel}
      </span>
      <Button
        variant="outline"
        // Disabled rather than `loading` once a run is under way: that prop
        // draws a spinner over the label and hides it, and the label is the only
        // thing separating a job nothing picked up from one that is working. The
        // spinner stays for the request that starts the run, where there is no
        // state to report yet.
        disabled={!hasEnoughProposals || isRunning}
        loading={isStarting}
        // Disabled reads as "unavailable", which a run in progress is not.
        aria-busy={isRunning}
        onClick={start}
      >
        <LuSparkles aria-hidden />
        {/* Named for what it produces. The control sits in the filter bar and
            does not follow it, so a bare "Analyze" beside an active filter would
            read as analysing that selection. */}
        {runningLabel ?? t('Find themes')}
      </Button>

      {/* Only rendered once there is a complete result to show. The dialog's own
          `open` would keep it mounted with nothing in it otherwise, and every
          section would have to defend against that. */}
      {/* Open for as long as it is mounted, which is exactly as long as there
          is a result. Opening is not a decision the reader made — they pressed a
          button and waited — and closing ends the run, which unmounts this. So
          the dialog has no third state to hold in `useState`. */}
      {completed && (
        <ThemeAnalysisDialog
          isOpen
          onOpenChange={handleDialogOpenChange}
          result={completed.result}
          analyzedCount={completed.analyzedCount}
          total={completed.total}
        />
      )}
    </>
  );
};
