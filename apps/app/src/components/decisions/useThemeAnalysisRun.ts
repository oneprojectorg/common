'use client';

import { trpc } from '@op/api/client';
import type {
  ThemeAnalysisErrorCode,
  ThemeAnalysisScope,
} from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type {
  CompletedThemeAnalysis,
  ThemeAnalysisPhase,
  ThemeAnalysisStatusRecord,
} from './themeAnalysisState';
import {
  isFollowingRun,
  isTerminalPhase,
  resolveCompletedThemeAnalysis,
  resolveFailureCode,
  resolveFailureDiagnostic,
  resolveRunningLabelKey,
  resolveThemeAnalysisPhase,
} from './themeAnalysisState';
import { THEME_ANALYSIS_WAIT_TIMEOUT_MS } from './themeAnalysisWait';

/**
 * Copy for each running-label key.
 *
 * A lookup rather than a ternary chain in the return, so adding a running state
 * is a row here instead of another branch inside the hook. Keyed on exactly the
 * keys `resolveRunningLabelKey` can return, so there is no default to fall
 * through to and no entry for "not running" — that case is the null key, and the
 * caller never reaches this table with it.
 */
const RUNNING_LABELS: Record<
  'analyzing' | 'preparing',
  (t: ReturnType<typeof useTranslations>) => string
> = {
  analyzing: (t) => t('Analyzing...'),
  preparing: (t) => t('Preparing...'),
};

/**
 * What to tell the facilitator for each way an analysis can fail.
 *
 * One entry per code, with no default: a code the app has no copy for would
 * otherwise reach a reader as nothing at all. `'unknown'` is the entry that
 * covers the failures nobody anticipated.
 */
const FAILURE_COPY: Record<
  ThemeAnalysisErrorCode,
  (t: ReturnType<typeof useTranslations>) => string
> = {
  'not-enough-text': (t) =>
    t("There isn't enough written in these proposals to compare them."),
  'analysis-unusable': (t) =>
    t("The analysis didn't come back in a usable form. Please try again."),
  unknown: (t) => t('The analysis failed'),
};

export interface ThemeAnalysisRun {
  /** The request to start a run is in flight. Nothing has been accepted yet. */
  isStarting: boolean;
  /** A run has been accepted and has not settled. */
  isRunning: boolean;
  /**
   * What the run is doing, for the button label and its live region. Null unless
   * {@link isRunning}, so a caller cannot label an idle control.
   */
  runningLabel: string | null;
  /** The finished analysis, or null until there is one. */
  completed: CompletedThemeAnalysis | null;
  start: () => void;
  /** Retires the run and returns the control to idle. */
  retire: () => void;
}

/**
 * Drives one theme-analysis run: start it, follow it, bound the wait, and report
 * what it produced.
 *
 * A run's state lives here rather than in the button, because none of it is
 * about rendering. What the button gets back is what a control needs to draw
 * itself. The branching that decides those values is pure and lives in
 * `themeAnalysisState`, where a test can reach it without a DOM.
 *
 * `analysisId` is the state everything else hangs off. Setting it enables the
 * status query; clearing it returns to idle. The analysis is a row that
 * outlives the session, but this id is the only handle the client holds on it,
 * so every path that clears it is deliberate: the caller retired it, the run
 * failed, or the wait timed out.
 *
 * @param processInstanceId - Decision instance to analyse.
 * @param scope - Which proposals the run reads.
 * @returns See {@link ThemeAnalysisRun}.
 */
export const useThemeAnalysisRun = (
  processInstanceId: string,
  scope: ThemeAnalysisScope,
): ThemeAnalysisRun => {
  const t = useTranslations();
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const { isSettled, clearSettled, latchSettled } = useSettledLatch();

  const startAnalysis = trpc.decision.analyzeThemes.useMutation({
    onSuccess: ({ analysisId: id }) => {
      setHasTimedOut(false);
      clearSettled();
      setAnalysisId(id);
    },
    onError: (error) => {
      // Not `error.message`. The only thing the server refuses this for is a
      // phase with too few proposals to compare, and it says so in English from
      // `@op/common`, which has no `useTranslations`. The button already
      // disables itself below that minimum, so reaching here at all is either a
      // race with a deletion or a caller that bypassed the control.
      logger.error('Failed to start theme analysis', { error });
      toast.error(t('Failed to start the analysis'));
    },
  });

  // No polling. The workflow broadcasts on this run's channel when it picks the
  // job up and again when the run settles, and the subscriber re-reads once the
  // channel is live — which covers a run reaching either of those before the
  // socket join lands.
  const { data: status } = trpc.decision.getThemeAnalysisStatus.useQuery(
    { analysisId: analysisId ?? '' },
    {
      // Stops once the run settles, and react-query keeps serving the settled
      // record from its cache. Without this, any later refetch — on window
      // focus, on reconnect — could answer `not_found` and undo a finished run:
      // that is what a read returns for a row it cannot see, and a `not_found`
      // reads as still-pending — so the dialog the facilitator was reading would
      // unmount, the button would go back to "Preparing...", and ten minutes
      // later they would be told an analysis they had just read had timed out.
      enabled: isFollowingRun({ analysisId, hasTimedOut, isSettled }),
      // Escalate to the caller's error boundary while the run is unresolved. A
      // failed status read is not inert here: `status` stays undefined, the run
      // reads as still in flight, and the silence timer below would report a
      // timeout — a claim about the run nothing can make.
      //
      // A completed record is exempt. Discarding it over a failed background
      // refetch would close the dialog on a result the reader is looking at.
      throwOnError: (_error, query) => query.state.data?.status !== 'completed',
      // The provider disables retries globally, which would make a single
      // dropped request terminal: it escalates, the button remounts at idle,
      // and `analysisId` goes with it, so a run that is still working writes a
      // result nothing can reach. A blip is not the "we cannot tell" the
      // escalation above is for, so absorb it first.
      retry: 2,
    },
  );

  const phase = resolveThemeAnalysisPhase({ analysisId, hasTimedOut, status });

  latchSettled(phase);

  const labelKey = resolveRunningLabelKey(phase);
  const isRunning = labelKey !== null;

  useRunTimeout(isRunning, phase, () => {
    setHasTimedOut(true);
    toast.error(t('The analysis timed out. Please try again.'));
    setAnalysisId(null);
  });

  useFailureReport(phase, status, t, () => {
    setAnalysisId(null);
    clearSettled();
  });

  return {
    isStarting: startAnalysis.isPending,
    isRunning,
    runningLabel: labelKey && RUNNING_LABELS[labelKey](t),
    completed: resolveCompletedThemeAnalysis(status),
    start: () => startAnalysis.mutate({ processInstanceId, scope }),
    retire: () => {
      setAnalysisId(null);
      clearSettled();
    },
  };
};

/**
 * Ends the wait when a run stops reporting.
 *
 * Bounds the run rather than its silence. The timer re-arms on a phase change,
 * but a run reports only `pending` then `processing` before it settles, so in
 * practice it arms once and then runs to the end — `themeAnalysisWait` sizes it
 * for that.
 *
 * It is the only thing that ends the wait when a broadcast never arrives: the
 * workflow died without writing a terminal status, or the socket dropped at the
 * wrong moment. There is no polling behind it.
 *
 * @param isRunning - A run is in flight. The timer only arms while this holds.
 * @param phase - Re-arms the timer when it changes.
 * @param onTimeout - Run when the bound is reached. Held in a ref, so a fresh
 *   closure each render does not restart the timer.
 */
const useRunTimeout = (
  isRunning: boolean,
  phase: ThemeAnalysisPhase,
  onTimeout: () => void,
) => {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = setTimeout(
      () => onTimeoutRef.current(),
      THEME_ANALYSIS_WAIT_TIMEOUT_MS,
    );

    return () => clearTimeout(timer);
  }, [isRunning, phase]);
};

/**
 * Remembers that a run reached an outcome, so nothing can take it back.
 *
 * Latched rather than derived from the newest read. The status query answers
 * `not_found` for a Redis client mid-reconnect as well as for a genuine miss,
 * and a `not_found` reads as still-pending — so a finished analysis could
 * otherwise be undone by a background refetch, unmounting the dialog the
 * facilitator was reading. This is what lets the query stop once there is an
 * answer.
 *
 * `latchSettled` is called during render rather than from an effect, and sets
 * state there. That is React's documented way to adjust state from something
 * rendering already knows, and it is what this needs: the phase is derived from
 * the status query, and the query's `enabled` reads `isSettled`, so the hook
 * cannot take the phase as an argument without the two depending on each other.
 * The `!isSettled` guard is what makes it terminate — React re-renders
 * immediately and then finds nothing left to change.
 *
 * @returns `isSettled`, `latchSettled` to call with each phase, and
 *   `clearSettled` for when a new run begins or the old one is retired.
 */
const useSettledLatch = () => {
  const [isSettled, setIsSettled] = useState(false);
  const clearSettled = useCallback(() => setIsSettled(false), []);
  const latchSettled = (phase: ThemeAnalysisPhase) => {
    if (isTerminalPhase(phase) && !isSettled) {
      setIsSettled(true);
    }
  };

  return { isSettled, clearSettled, latchSettled };
};

/**
 * Tells the facilitator a run failed, once, and returns the control to idle.
 *
 * The copy comes from the code the workflow recorded, so it is in the reader's
 * own locale. The record's `errorMessage` is English, composed in `@op/common`,
 * which has no `useTranslations` — it goes to the log, where it names the pass
 * and the counts and is worth having.
 *
 * Fires once because `onFailed` returns the run to idle, which moves the phase
 * off `failed`.
 *
 * @param phase - The run's phase. Nothing happens unless it is `failed`.
 * @param status - The record the code and the diagnostic come from.
 * @param t - Translator for the failure copy.
 * @param onFailed - Returns the control to idle.
 */
const useFailureReport = (
  phase: ThemeAnalysisPhase,
  status: ThemeAnalysisStatusRecord | undefined,
  t: ReturnType<typeof useTranslations>,
  onFailed: () => void,
) => {
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  useEffect(() => {
    if (phase !== 'failed') {
      return;
    }

    logger.error('Theme analysis failed', {
      error: resolveFailureDiagnostic(status),
    });
    toast.error(FAILURE_COPY[resolveFailureCode(status)](t));
    onFailedRef.current();
  }, [phase, status, t]);
};
