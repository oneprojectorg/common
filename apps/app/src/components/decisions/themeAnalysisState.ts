import type {
  ThemeAnalysisErrorCode,
  ThemeAnalysisResponse,
  ThemeAnalysisResult,
} from '@op/api/encoders';

import { THEME_ANALYSIS_POLL_INTERVAL_MS } from './themeAnalysisWait';

/**
 * What `decision.getThemeAnalysisStatus` answers: one parsed record, or the
 * not-found arm.
 *
 * The server's own schema, re-exported through the encoders rather than
 * re-declared here. A hand-written copy passes typecheck while the server adds a
 * status value or renames a field, and the client goes on branching on a shape
 * that no longer arrives.
 */
export type ThemeAnalysisStatusRecord = ThemeAnalysisResponse;

/** A finished analysis, with the coverage the dialog states alongside it. */
export interface CompletedThemeAnalysis {
  result: ThemeAnalysisResult;
  analyzedCount: number;
  total: number;
}

/**
 * What a theme-analysis run is doing, from the client's point of view.
 *
 * `idle` covers both "nothing started" and "the last run has been retired". The
 * two are the same to a control, and keeping them apart would mean a state the
 * button renders identically.
 */
export type ThemeAnalysisPhase =
  /** No run to follow. */
  | 'idle'
  /** Accepted, but nothing has reported picking it up. */
  | 'pending'
  /** The workflow has the job and is working. */
  | 'processing'
  /** Finished, with a result to show. */
  | 'completed'
  /** Finished without one. */
  | 'failed';

/**
 * Decides what phase a run is in, from the id, the record, and the timeout.
 *
 * Pure, and apart from the hook so a test can drive every phase directly:
 * `apps/app` runs Vitest under `environment: 'node'` and installs no DOM, so it
 * supports no hook test. The same reason `exportRetry` sits beside its button.
 *
 * The states that matter least on a happy path matter most here. A run whose
 * status read has not landed yet must read as `pending` rather than as an error,
 * because the record is legitimately absent for the first moment of every run.
 * A timed-out run must read as `idle` rather than as `failed`: the wait ended,
 * which is not the same as the workflow reporting anything, and calling it a
 * failure would claim knowledge the client does not have.
 *
 * @param analysisId - The run being followed, or null when there is none.
 * @param hasTimedOut - The client gave up waiting.
 * @param status - The record, or undefined when the read has not landed.
 * @returns Which phase the run is in.
 */
export const resolveThemeAnalysisPhase = ({
  analysisId,
  hasTimedOut,
  status,
}: {
  analysisId: string | null;
  hasTimedOut: boolean;
  status?: ThemeAnalysisStatusRecord;
}): ThemeAnalysisPhase => {
  if (analysisId === null || hasTimedOut) {
    return 'idle';
  }

  if (status?.status === 'completed') {
    return 'completed';
  }

  if (status?.status === 'failed') {
    return 'failed';
  }

  // Everything else is a run still in flight: `pending`, `processing`, a
  // `not_found` record the workflow has yet to write, or a read that has not
  // landed. Only `processing` is evidence that something picked the job up, and
  // that distinction is the whole reason the label has two forms — a wait stuck
  // on `pending` means nothing took the job, which is a different thing to chase
  // than a slow one.
  return status?.status === 'processing' ? 'processing' : 'pending';
};

/**
 * Which running label a phase calls for, or null when the control is not
 * running.
 *
 * Returns a key rather than copy, because this module is framework- and
 * locale-agnostic and the hook is where `t()` lives.
 *
 * Two labels rather than one. A wait stuck on `preparing` means nothing picked
 * the job up, which is a different thing to chase than a slow job, and one
 * label for both throws that distinction away — for the screen reader as much
 * as for the person watching the button.
 *
 * @param phase - The run's phase.
 * @returns `'analyzing'`, `'preparing'`, or null when the run is not in flight.
 */
export const resolveRunningLabelKey = (
  phase: ThemeAnalysisPhase,
): 'analyzing' | 'preparing' | null => {
  if (phase === 'processing') {
    return 'analyzing';
  }

  return phase === 'pending' ? 'preparing' : null;
};

/**
 * Should the client still be reading this run's status?
 *
 * All three reasons to stop are here rather than spread across a boolean
 * expression: there is no run, the client gave up waiting, or the run reached an
 * outcome. The last is what stops a background refetch from undoing a finished
 * analysis — see the latch in `useThemeAnalysisRun`.
 *
 * @param analysisId - The run being followed, or null when there is none.
 * @param hasTimedOut - The client gave up waiting.
 * @param isSettled - The run reported a terminal state.
 * @returns True while the status is worth reading.
 */
export const isFollowingRun = ({
  analysisId,
  hasTimedOut,
  isSettled,
}: {
  analysisId: string | null;
  hasTimedOut: boolean;
  isSettled: boolean;
}): boolean => analysisId !== null && !hasTimedOut && !isSettled;

/**
 * Has the run reported an outcome it will not take back?
 *
 * `idle` is not terminal — it is the absence of a run, which a later one
 * replaces. The two real outcomes are, and once a run reaches either, nothing a
 * later read says should move it: the hook stops polling on this, so a
 * `not_found` from a read that could not see the row cannot undo a finished
 * analysis.
 *
 * @param phase - The run's phase.
 * @returns True for `completed` and `failed`.
 */
export const isTerminalPhase = (phase: ThemeAnalysisPhase): boolean =>
  phase === 'completed' || phase === 'failed';

/**
 * The diagnostic a failed run recorded, for the log.
 *
 * Never rendered — {@link resolveFailureCode} is what the facilitator sees. This
 * is the English detail that names the pass and the counts, which is what makes
 * a log line worth reading.
 *
 * @param status - The record, or undefined when the read has not landed.
 * @returns What the workflow recorded, or undefined.
 */
export const resolveFailureDiagnostic = (
  status?: ThemeAnalysisStatusRecord,
): string | undefined =>
  status && 'errorMessage' in status ? status.errorMessage : undefined;

/**
 * Why a failed run failed, as a code this app has copy for.
 *
 * Never the record's `errorMessage`. That string is composed in `@op/common`,
 * which has no `useTranslations`, so rendering it shows English to a facilitator
 * whatever their locale — and on some paths it names a model pass, which is
 * routing metadata rather than anything they can act on. The message stays in
 * the record for the log; this is what the toast is built from.
 *
 * The record is a discriminated union whose not-found arm carries no code field
 * at all, so the field is checked rather than asserted. Anything without a code
 * — a record written before codes existed, a failure nobody anticipated — reads
 * as `'unknown'`, which has copy of its own.
 *
 * @param status - The record, or undefined when the read has not landed.
 * @returns The failure's code.
 */
export const resolveFailureCode = (
  status?: ThemeAnalysisStatusRecord,
): ThemeAnalysisErrorCode =>
  status && 'errorCode' in status && status.errorCode
    ? status.errorCode
    : 'unknown';

/**
 * The finished analysis on a record, or null when there is not a complete one.
 *
 * The counts are part of "complete". The workflow writes them in the same update
 * that writes the result, so a completed record missing one is a record from
 * before this shipped — and the coverage line is not decoration, it is what
 * stops a partial synthesis from reading as a statement about the whole process.
 * Reported as unfinished rather than shown without it.
 *
 * `!= null` rather than a truthiness check: an analysis that read zero proposals
 * cannot reach a completed record, but a count of `0` reaching here should say
 * "0 of 400" rather than disappear.
 *
 * @param status - The record, or undefined when the read has not landed.
 * @returns The result and its coverage, or null.
 */
export const resolveCompletedThemeAnalysis = (
  status?: ThemeAnalysisStatusRecord,
): CompletedThemeAnalysis | null => {
  if (
    status?.status !== 'completed' ||
    !status.result ||
    status.analyzedCount == null ||
    status.total == null
  ) {
    return null;
  }

  return {
    result: status.result,
    analyzedCount: status.analyzedCount,
    total: status.total,
  };
};

/**
 * How often to re-read the status, given where the run has got to.
 *
 * `false` once the run has an outcome — polling a settled record would re-ask a
 * question that already has an answer, and the query disables itself there
 * anyway. Everything before that polls, because until then the client has no
 * guaranteed way of hearing that the run finished.
 *
 * @param phase - The run's current phase.
 * @returns Milliseconds between reads, or false to stop.
 */
export const resolveStatusPollInterval = (
  phase: ThemeAnalysisPhase,
): number | false =>
  isTerminalPhase(phase) ? false : THEME_ANALYSIS_POLL_INTERVAL_MS;
