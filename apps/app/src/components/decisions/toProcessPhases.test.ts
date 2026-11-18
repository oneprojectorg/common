import { describe, expect, it } from 'vitest';

import { toProcessPhases } from './toProcessPhases';

describe('toProcessPhases', () => {
  it('returns no phases when the instance has none', () => {
    expect(toProcessPhases(undefined)).toEqual([]);
    expect(toProcessPhases([])).toEqual([]);
  });

  it('maps a stored phase to the timeline shape', () => {
    expect(
      toProcessPhases([
        {
          phaseId: 'submission',
          name: 'Submission',
          description: 'Share ideas',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-02-01T00:00:00.000Z',
          rules: {
            proposals: { submit: true },
            advancement: { method: 'manual' },
          },
        },
      ]),
    ).toEqual([
      {
        id: 'submission',
        name: 'Submission',
        description: 'Share ideas',
        phase: {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-02-01T00:00:00.000Z',
        },
        advancementMethod: 'manual',
        config: { allowProposals: true },
      },
    ]);
  });

  it('gives an unnamed phase an empty name and keeps the stored order', () => {
    const phases = toProcessPhases([
      { phaseId: 'b' },
      { phaseId: 'a', name: 'Voting' },
    ]);

    expect(phases.map((p) => p.id)).toEqual(['b', 'a']);
    expect(phases[0]?.name).toBe('');
    expect(phases[0]?.config).toEqual({ allowProposals: undefined });
  });
});
