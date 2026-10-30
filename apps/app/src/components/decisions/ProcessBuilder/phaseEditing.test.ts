import { describe, expect, it } from 'vitest';

import { toEditablePhases, toPhasesPayload } from './phaseEditing';
import { toPhasesWithBudget } from './processBudgetPatch';

const storedPhases = [
  {
    phaseId: 'submission',
    name: 'Submission',
    headline: 'Send in your application',
    rules: { proposals: { submit: true } },
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    settings: { budget: 25000, allowProposals: true },
  },
  {
    phaseId: 'review',
    name: 'Review',
    rules: {},
  },
];

describe('phase editing keeps phase settings', () => {
  it('keeps a pending budget patch when a phase is edited before Update Process', () => {
    const pending = toPhasesWithBudget(storedPhases, 31000);

    const edited = toEditablePhases(pending!).map((phase) =>
      phase.id === 'review' ? { ...phase, name: 'Final review' } : phase,
    );

    const payload = toPhasesPayload(edited);

    expect(payload[0]?.settings).toEqual({
      budget: 31000,
      allowProposals: true,
    });
    expect(payload[1]).toMatchObject({
      phaseId: 'review',
      name: 'Final review',
    });
  });

  it('round-trips every phase field the editors use', () => {
    const payload = toPhasesPayload(toEditablePhases(storedPhases));

    expect(payload[0]).toEqual({
      phaseId: 'submission',
      name: 'Submission',
      description: undefined,
      headline: 'Send in your application',
      additionalInfo: undefined,
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      rules: { proposals: { submit: true } },
      settings: { budget: 25000, allowProposals: true },
    });
  });

  it('leaves the settings key out for a phase that has none, so the server keeps its stored settings', () => {
    const payload = toPhasesPayload(toEditablePhases(storedPhases));

    expect(payload[1]).not.toHaveProperty('settings');
  });

  it('drops a deleted phase together with its settings', () => {
    const edited = toEditablePhases(storedPhases).filter(
      (phase) => phase.id !== 'submission',
    );

    expect(toPhasesPayload(edited)).toEqual([
      expect.objectContaining({ phaseId: 'review' }),
    ]);
  });
});
