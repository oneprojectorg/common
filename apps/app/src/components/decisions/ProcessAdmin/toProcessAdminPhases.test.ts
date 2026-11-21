import { describe, expect, it } from 'vitest';

import { toProcessAdminPhases } from './toProcessAdminPhases';

const phases = [
  { phaseId: 'submit', name: 'Submit', startDate: '2026-01-01T00:00:00.000Z' },
  {
    phaseId: 'vote',
    description: 'Pick three',
    rules: { voting: { submit: true, maxVotesPerMember: 3 } },
  },
];

describe('toProcessAdminPhases', () => {
  it('keys each phase by its stored id in stored order', () => {
    const result = toProcessAdminPhases({ phases, currentStateId: 'vote' });

    expect(result.map((phase) => [phase.id, phase.sortOrder])).toEqual([
      ['submit', 0],
      ['vote', 1],
    ]);
  });

  it('marks the instance current phase and nothing else', () => {
    const result = toProcessAdminPhases({ phases, currentStateId: 'vote' });

    expect(result.map((phase) => phase.isCurrent)).toEqual([false, true]);
  });

  it('marks no phase when the instance has no current state', () => {
    const result = toProcessAdminPhases({ phases, currentStateId: null });

    expect(result.some((phase) => phase.isCurrent)).toBe(false);
  });

  it('defaults a missing name to empty and carries rules through', () => {
    const [, vote] = toProcessAdminPhases({ phases, currentStateId: null });

    expect(vote?.name).toBe('');
    expect(vote?.description).toBe('Pick three');
    expect(vote?.rules?.voting?.maxVotesPerMember).toBe(3);
  });

  it('returns nothing for a missing phase list', () => {
    expect(
      toProcessAdminPhases({ phases: undefined, currentStateId: 'x' }),
    ).toEqual([]);
  });
});
