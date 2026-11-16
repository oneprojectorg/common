import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils';
import {
  assertPastPhasesUnchanged,
  assertPhaseNamesFit,
  assertPhasesCanBeMinted,
} from './phaseHelpers';
import type { PhaseInstanceData } from './schemas/instanceData';
import { MAX_PHASE_NAME_LENGTH } from './schemas/phaseName';

vi.mock('@op/db/client', () => ({ db: {} }));
vi.mock('../assert', () => ({ assertProfileAccess: vi.fn() }));

describe('assertPhasesCanBeMinted', () => {
  it('accepts distinct ids', () => {
    expect(() =>
      assertPhasesCanBeMinted([
        { phaseId: 'submission', name: 'Submission' },
        { phaseId: 'voting' },
      ]),
    ).not.toThrow();
  });

  it.for([
    {
      label: 'a phase with no id',
      message: /There is a phase with no id/,
      phases: [{ phaseId: '', name: 'Submission' }],
    },
    {
      label: 'two phases with one id',
      message: /There are two phases with the id "submission"/,
      phases: [{ phaseId: 'submission' }, { phaseId: 'submission' }],
    },
  ])('refuses $label', ({ message, phases }) => {
    expect(() => assertPhasesCanBeMinted(phases)).toThrow(ValidationError);
    expect(() => assertPhasesCanBeMinted(phases)).toThrow(message);
  });
});

describe('assertPhaseNamesFit', () => {
  it('accepts a name of exactly the maximum length', () => {
    expect(() =>
      assertPhaseNamesFit([
        { phaseId: 'submission', name: 'x'.repeat(MAX_PHASE_NAME_LENGTH) },
      ]),
    ).not.toThrow();
  });

  it('refuses a name over the maximum length', () => {
    const phases = [
      { phaseId: 'submission', name: 'x'.repeat(MAX_PHASE_NAME_LENGTH + 1) },
    ];
    expect(() => assertPhaseNamesFit(phases)).toThrow(ValidationError);
    expect(() => assertPhaseNamesFit(phases)).toThrow(/at most 256/);
  });
});

describe('assertPastPhasesUnchanged', () => {
  const dateRules = { advancement: { method: 'date' as const } };
  const before: PhaseInstanceData[] = [
    {
      phaseId: 'submission',
      name: 'Submission',
      description: 'Send proposals',
      rules: dateRules,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
    },
    {
      phaseId: 'review',
      name: 'Review',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-08-01T00:00:00.000Z',
    },
    {
      phaseId: 'voting',
      name: 'Voting',
      rules: dateRules,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-09-01T00:00:00.000Z',
    },
    { phaseId: 'results', name: 'Results' },
  ];
  const [submission, review, voting, results] = before as [
    PhaseInstanceData,
    PhaseInstanceData,
    PhaseInstanceData,
    PhaseInstanceData,
  ];
  const assertAfter =
    (after: PhaseInstanceData[], currentStateId: string | null = 'voting') =>
    () =>
      assertPastPhasesUnchanged({ before, after, currentStateId });

  it.for([
    { label: 'an unchanged list', after: before },
    {
      label: 'new text on a past phase',
      after: [
        { ...submission, name: 'Ideas', description: 'New', headline: 'Hi' },
        review,
        voting,
        results,
      ],
    },
    {
      label: 'a resave that spells an absent rule set as empty',
      after: [submission, { ...review, rules: {} }, voting, results],
    },
    {
      label: 'a resave of the same instant in another format',
      after: [
        { ...submission, endDate: '2026-07-01T00:00:00Z' },
        review,
        voting,
        results,
      ],
    },
    {
      label: 'a new end date and advancement on the current phase',
      after: [
        submission,
        review,
        {
          ...voting,
          endDate: '2026-10-01T00:00:00.000Z',
          rules: { advancement: { method: 'manual' as const } },
        },
        results,
      ],
    },
    {
      label: 'phases added, removed and reordered after the current one',
      after: [
        submission,
        review,
        voting,
        { phaseId: 'appeals' },
        { ...results, rules: dateRules },
      ],
    },
  ])('accepts $label', ({ after }) => {
    expect(assertAfter(after)).not.toThrow();
  });

  it.for([
    {
      label: 'a past phase deleted',
      after: [submission, voting, results],
      message: /cannot be removed, added or reordered/,
    },
    {
      label: 'a phase inserted before the current one',
      after: [submission, { phaseId: 'extra' }, review, voting, results],
      message: /cannot be removed, added or reordered/,
    },
    {
      label: 'past phases swapped',
      after: [review, submission, voting, results],
      message: /cannot be removed, added or reordered/,
    },
    {
      label: 'the current phase moved',
      after: [submission, review, results, voting],
      message: /cannot be removed, added or reordered/,
    },
    {
      label: 'a past phase end date changed',
      after: [
        { ...submission, endDate: '2026-07-02T00:00:00.000Z' },
        review,
        voting,
        results,
      ],
      message: /past phase "Submission"/,
    },
    {
      label: 'a past phase advancement changed',
      after: [submission, { ...review, rules: dateRules }, voting, results],
      message: /past phase "Review"/,
    },
    {
      label: 'a past phase settings changed',
      after: [
        { ...submission, settings: { budget: 10 } },
        review,
        voting,
        results,
      ],
      message: /past phase "Submission"/,
    },
    {
      label: 'the current phase start date changed',
      after: [
        submission,
        review,
        { ...voting, startDate: '2026-08-02T00:00:00.000Z' },
        results,
      ],
      message: /start date of the current phase/,
    },
  ])('refuses $label', ({ after, message }) => {
    expect(assertAfter(after)).toThrow(ValidationError);
    expect(assertAfter(after)).toThrow(message);
  });

  it('accepts any change when the decision has no current phase', () => {
    expect(assertAfter([results, voting], null)).not.toThrow();
  });

  it('refuses every change when the current phase is not in the list', () => {
    expect(assertAfter(before, 'gone')).toThrow(/current phase is missing/);
  });
});
