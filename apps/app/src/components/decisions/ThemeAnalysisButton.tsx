'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { ThemeAnalysisScope } from '@op/api/encoders';
import { THEME_ANALYSIS_MIN_PROPOSALS } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { LuRefreshCw, LuSparkles, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ThemeAnalysisDialog,
  type ThemeAnalysisRoute,
} from './ThemeAnalysisDialog';
import { useLatestThemeAnalysis } from './useLatestThemeAnalysis';
import { useThemeAnalysisRun } from './useThemeAnalysisRun';

export interface ThemeAnalysisButtonProps {
  processInstanceId: string;
  /**
   * Which proposals to analyse — the surface's own set. `phase` for the
   * proposals list, `process` for the results screen, which shows every proposal
   * the instance has held including ones dropped in an earlier phase. Analysing
   * the wrong one would report a synthesis of proposals the reader is not
   * looking at.
   */
  scope: ThemeAnalysisScope;
  /**
   * Proposals in the phase, unfiltered. The analysis ignores the list's
   * filters, so a view narrowed to nothing still has a corpus to read — this is
   * the phase's own count, which is what the server checks against.
   */
  proposalCount: number;
  /**
   * Where the proposals live, so the dialog can link each one it names. See
   * {@link ThemeAnalysisRoute}.
   */
  route: ThemeAnalysisRoute;
  /**
   * Whether the dialog may offer Merge on a merge suggestion. The caller
   * decides, from the same flag and role the card menu reads.
   */
  canMerge: boolean;
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
 * React component for the control itself, plus the dialog it opens.
 *
 * Two ways in, one dialog. When a stored analysis exists — the scheduled
 * refresh writes one after the instance's proposals change — the control says
 * "View themes" and opens it at once. When none exists it says "Find themes"
 * and runs one, the way it always did; the run writes the snapshot, so the next
 * press is a view. From inside the dialog the reader can ask for a fresh run,
 * and its result replaces what they were reading when it lands.
 *
 * The run's state lives in {@link useThemeAnalysisRun} and the stored analysis
 * in {@link useLatestThemeAnalysis}, so what is left here is what a control is
 * for: whether it can be pressed, what it says, and what it announces. The
 * only state of its own is whether the reader chose to open the stored
 * analysis.
 *
 * Sits behind {@link ThemeAnalysisButton}'s error boundary rather than being
 * exported, so a reset remounts it and discards the run.
 *
 * @param processInstanceId - Decision instance to analyse.
 * @param scope - Which proposals to read. See {@link ThemeAnalysisButtonProps}.
 * @param proposalCount - The scope's unfiltered proposal count, which decides
 *   whether there is anything to compare.
 * @param route - Passed through to the dialog for its links.
 * @param canMerge - Passed through to the dialog for its Merge actions.
 */
const ThemeAnalysisButtonContent = ({
  processInstanceId,
  scope,
  proposalCount,
  route,
  canMerge,
}: ThemeAnalysisButtonProps) => {
  const t = useTranslations();
  const { snapshot, isLoading: isLoadingSnapshot } = useLatestThemeAnalysis(
    processInstanceId,
    scope,
  );
  const { isStarting, isRunning, runningLabel, completed, start, retire } =
    useThemeAnalysisRun(processInstanceId, scope);
  const [isViewing, setIsViewing] = useState(false);

  // A run that just finished outranks the stored one: it is the newer of the
  // two, and it is what the reader asked for. The stored one is shown only
  // when the reader opened it. Once the run is retired, the store — refreshed
  // by the run's own broadcast — is what a reopen shows.
  const shown = completed
    ? { ...completed, completedAt: undefined }
    : isViewing
      ? snapshot
      : null;

  // Closing ends the run and the view together. Each press produces one
  // analysis, and holding on to it would leave a later run indistinguishable
  // from this one.
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setIsViewing(false);
      retire();
    }
  };

  // The same number the request service refuses below, taken from the one
  // definition rather than mirrored: an enabled button whose only possible
  // outcome is a validation error is an action we should not have offered.
  const hasEnoughProposals = proposalCount >= THEME_ANALYSIS_MIN_PROPOSALS;

  // Viewing needs no proposals — the analysis is already written — so a stored
  // analysis stays openable even after the phase drops below the minimum.
  const canView = snapshot !== null && !isRunning;

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
      {canView ? (
        <Button variant="outline" onClick={() => setIsViewing(true)}>
          <LuSparkles aria-hidden />
          {t('View themes')}
        </Button>
      ) : (
        <Button
          variant="outline"
          // Disabled rather than `loading` once a run is under way: that prop
          // draws a spinner over the label and hides it, and the label is the
          // only thing separating a job nothing picked up from one that is
          // working. The spinner stays for the request that starts the run,
          // where there is no state to report yet — and for the first read of
          // the store, before the control knows which of its two labels it is.
          disabled={!hasEnoughProposals || isRunning}
          loading={isStarting || isLoadingSnapshot}
          // Disabled reads as "unavailable", which a run in progress is not.
          aria-busy={isRunning}
          onClick={start}
        >
          <LuSparkles aria-hidden />
          {/* Named for what it produces. The control sits in the filter bar
              and does not follow it, so a bare "Analyze" beside an active
              filter would read as analysing that selection. */}
          {runningLabel ?? t('Find themes')}
        </Button>
      )}

      {/* Only rendered once there is a complete result to show. The dialog's own
          `open` would keep it mounted with nothing in it otherwise, and every
          section would have to defend against that. */}
      {/* Open for as long as it is mounted, which is exactly as long as there
          is something to show. Closing retires the run and the view, which
          unmounts this. So the dialog has no third state to hold. */}
      {shown && (
        <ThemeAnalysisDialog
          isOpen
          onOpenChange={handleDialogOpenChange}
          result={shown.result}
          analyzedCount={shown.analyzedCount}
          total={shown.total}
          completedAt={shown.completedAt}
          route={route}
          canMerge={canMerge}
          actions={
            // A fresh run from inside the dialog, for a reader who suspects the
            // stored analysis is behind the proposals — the refresh waits out a
            // quiet half hour before it runs, and a facilitator mid-triage may
            // not want to. Same gate as the bar's button, same labels while it
            // runs, and its result replaces this dialog's content when it lands.
            <Button
              variant="outline"
              disabled={!hasEnoughProposals || isRunning}
              loading={isStarting}
              aria-busy={isRunning}
              onClick={start}
            >
              <LuRefreshCw aria-hidden />
              {runningLabel ?? t('Analyze again')}
            </Button>
          }
        />
      )}
    </>
  );
};
