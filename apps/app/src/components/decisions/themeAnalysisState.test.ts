import type { ThemeAnalysisResult } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import type { ThemeAnalysisStatusRecord } from './themeAnalysisState';
import {
  isFollowingRun,
  isTerminalPhase,
  resolveCompletedThemeAnalysis,
  resolveFailureCode,
  resolveRunningLabelKey,
  resolveThemeAnalysisPhase,
} from './themeAnalysisState';

const ANALYSIS_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

// The bookkeeping every non-not-found record carries. Spread rather than left
// out: the type is the server's own response schema, so a fixture missing these
// is a shape the client will never actually be handed.
const RECORD_BASE = {
  analysisId: ANALYSIS_ID,
  processInstanceId: INSTANCE_ID,
  userId: AUTH_USER_ID,
  createdAt: '2026-09-07T12:00:00.000Z',
} as const;

// The record arm of the response union. Named so a fixture can be spread and
// overridden without collapsing onto the not-found arm.
type ThemeAnalysisRecord = Extract<
  ThemeAnalysisStatusRecord,
  { analysisId: string }
>;

const record = (
  fields: Omit<ThemeAnalysisRecord, keyof typeof RECORD_BASE>,
): ThemeAnalysisRecord => ({ ...RECORD_BASE, ...fields });

const result: ThemeAnalysisResult = {
  themes: [{ title: 'Street space', summary: 'Road space.', proposals: [] }],
  commonGround: [],
  outliers: [],
  suggestions: [],
};

// `analysisId` defaults with `===  undefined` rather than `??`, because `null`
// is the value half these cases are about and `??` would swallow it.
const phaseOf = (
  status?: ThemeAnalysisStatusRecord,
  overrides: { analysisId?: string | null; hasTimedOut?: boolean } = {},
) =>
  resolveThemeAnalysisPhase({
    analysisId:
      overrides.analysisId === undefined ? ANALYSIS_ID : overrides.analysisId,
    hasTimedOut: overrides.hasTimedOut ?? false,
    status,
  });

describe('resolveThemeAnalysisPhase', () => {
  it('is idle before anything has been started', () => {
    expect(phaseOf(undefined, { analysisId: null })).toBe('idle');
  });

  // The wait ending is not the workflow reporting anything. Calling it `failed`
  // would claim knowledge the client does not have, and would show a toast for
  // an analysis that may yet finish.
  it('is idle after the wait times out, not failed', () => {
    expect(
      phaseOf(record({ status: 'processing' }), { hasTimedOut: true }),
    ).toBe('idle');
  });

  // The record is legitimately absent for the first moment of every run: the
  // request seeds it, but the read can land first.
  it('is pending while the status read has not landed', () => {
    expect(phaseOf(undefined)).toBe('pending');
  });

  it('is pending for a record the workflow has not written yet', () => {
    expect(phaseOf({ status: 'not_found' as const })).toBe('pending');
  });

  it('is pending for an accepted run nothing has picked up', () => {
    expect(phaseOf(record({ status: 'pending' }))).toBe('pending');
  });

  // Only `processing` is evidence something took the job, which is what
  // separates a slow run from one nothing picked up.
  it('is processing once the workflow reports it has the job', () => {
    expect(phaseOf(record({ status: 'processing' }))).toBe('processing');
  });

  it('is completed on a completed record', () => {
    expect(phaseOf(record({ status: 'completed' }))).toBe('completed');
  });

  it('is failed on a failed record', () => {
    expect(phaseOf(record({ status: 'failed' }))).toBe('failed');
  });

  // A terminal record read after the client gave up must not re-open the run:
  // the button has already returned to idle and dropped the id.
  it('stays idle when a terminal record arrives after a timeout', () => {
    expect(
      phaseOf(record({ status: 'completed' }), { hasTimedOut: true }),
    ).toBe('idle');
  });
});

describe('isFollowingRun', () => {
  const following = (
    overrides: Partial<Parameters<typeof isFollowingRun>[0]>,
  ) =>
    isFollowingRun({
      analysisId: ANALYSIS_ID,
      hasTimedOut: false,
      isSettled: false,
      ...overrides,
    });

  it('follows a run that is under way', () => {
    expect(following({})).toBe(true);
  });

  it('follows nothing when no run has started', () => {
    expect(following({ analysisId: null })).toBe(false);
  });

  it('stops once the client has given up waiting', () => {
    expect(following({ hasTimedOut: true })).toBe(false);
  });

  // The one that matters most: a later read answering `not_found` during a cache
  // blip would otherwise undo a finished analysis the facilitator is reading.
  it('stops once the run has reported an outcome', () => {
    expect(following({ isSettled: true })).toBe(false);
  });
});

describe('isTerminalPhase', () => {
  it.each(['completed', 'failed'] as const)('%s is terminal', (phase) => {
    expect(isTerminalPhase(phase)).toBe(true);
  });

  // `idle` is the absence of a run, which a later one replaces — latching on it
  // would stop the client following the next analysis at all.
  it.each(['idle', 'pending', 'processing'] as const)(
    '%s is not terminal',
    (phase) => {
      expect(isTerminalPhase(phase)).toBe(false);
    },
  );
});

describe('resolveRunningLabelKey', () => {
  // The two in-flight labels are the point: a wait stuck on "preparing" means
  // nothing picked the job up, which is a different thing to chase than a slow
  // job.
  it('distinguishes a job nothing has picked up from one that is working', () => {
    expect(resolveRunningLabelKey('pending')).toBe('preparing');
    expect(resolveRunningLabelKey('processing')).toBe('analyzing');
  });

  // A key here would label an idle control as busy, and the button renders the
  // label into a live region.
  it.each(['idle', 'completed', 'failed'] as const)(
    'labels nothing in the %s phase',
    (phase) => {
      expect(resolveRunningLabelKey(phase)).toBeNull();
    },
  );
});

describe('resolveFailureCode', () => {
  it('returns the code the workflow recorded', () => {
    expect(
      resolveFailureCode(
        record({ status: 'failed', errorCode: 'not-enough-text' }),
      ),
    ).toBe('not-enough-text');
  });

  // Never the message. It is composed in `@op/common`, which has no
  // `useTranslations`, so rendering it would show English whatever the locale.
  it('ignores the diagnostic message entirely', () => {
    expect(
      resolveFailureCode(
        record({
          status: 'failed',
          errorCode: 'analysis-unusable',
          errorMessage: 'The proposal-common-ground pass returned no JSON.',
        }),
      ),
    ).toBe('analysis-unusable');
  });

  // A record from before codes existed, or a failure nobody anticipated. The
  // app has copy for `unknown`; it has none for `undefined`.
  it('reads a failure with no code as unknown', () => {
    expect(resolveFailureCode(record({ status: 'failed' }))).toBe('unknown');
  });

  // The not-found arm of the record union carries no code field at all.
  it('reads a record with no code field as unknown', () => {
    expect(resolveFailureCode({ status: 'not_found' as const })).toBe(
      'unknown',
    );
    expect(resolveFailureCode(undefined)).toBe('unknown');
  });
});

describe('resolveCompletedThemeAnalysis', () => {
  const completedRecord = record({
    status: 'completed',
    result,
    analyzedCount: 40,
    total: 120,
  });

  it('returns the result with the coverage it was built from', () => {
    expect(resolveCompletedThemeAnalysis(completedRecord)).toEqual({
      result,
      analyzedCount: 40,
      total: 120,
    });
  });

  it('returns nothing for a run that has not finished', () => {
    expect(
      resolveCompletedThemeAnalysis(record({ status: 'processing' })),
    ).toBeNull();
  });

  it('returns nothing when the read has not landed', () => {
    expect(resolveCompletedThemeAnalysis(undefined)).toBeNull();
  });

  it('returns nothing for a completed record carrying no result', () => {
    expect(
      resolveCompletedThemeAnalysis({ ...completedRecord, result: undefined }),
    ).toBeNull();
  });

  // The coverage line is what stops a partial synthesis from reading as a
  // statement about the whole process, so a result without it is not showable.
  it.each(['analyzedCount', 'total'] as const)(
    'returns nothing for a completed record missing %s',
    (field) => {
      expect(
        resolveCompletedThemeAnalysis({
          ...completedRecord,
          [field]: undefined,
        }),
      ).toBeNull();
    },
  );

  // Reachable in principle and a real number: "0 of 400" is a legible answer,
  // where a truthiness check would silently drop the whole result.
  it('keeps a zero count rather than reading it as missing', () => {
    expect(
      resolveCompletedThemeAnalysis({ ...completedRecord, analyzedCount: 0 }),
    ).toMatchObject({ analyzedCount: 0, total: 120 });
  });
});
