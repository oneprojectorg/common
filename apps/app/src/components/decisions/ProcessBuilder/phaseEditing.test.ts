import { describe, expect, it } from 'vitest';

import { toEditablePhases, toPhasesPayload } from './phaseEditing';

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

describe('phase editing keeps pending phase settings without echoing stored ones', () => {
  it('sends settings that differ from the snapshot alongside the phase edit', () => {
    const pending = [
      {
        ...storedPhases[0]!,
        settings: { budget: 31000, allowProposals: true },
      },
      storedPhases[1]!,
    ];

    const edited = toEditablePhases(pending).map((phase) =>
      phase.id === 'review' ? { ...phase, name: 'Final review' } : phase,
    );

    const payload = toPhasesPayload(edited, storedPhases);

    expect(payload[0]?.settings).toEqual({
      budget: 31000,
      allowProposals: true,
    });
    expect(payload[1]).toMatchObject({
      phaseId: 'review',
      name: 'Final review',
    });
  });

  it('omits settings that only echo the loaded snapshot, so another admin’s saved budget survives a phase edit', () => {
    const edited = toEditablePhases(storedPhases).map((phase) =>
      phase.id === 'submission' ? { ...phase, name: 'Applications' } : phase,
    );

    const payload = toPhasesPayload(edited, storedPhases);

    expect(payload[0]).toMatchObject({
      phaseId: 'submission',
      name: 'Applications',
    });
    expect(payload[0]).not.toHaveProperty('settings');
  });

  it('round-trips every phase field the editors use', () => {
    const payload = toPhasesPayload(toEditablePhases(storedPhases), []);

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
    const payload = toPhasesPayload(toEditablePhases(storedPhases), []);

    expect(payload[1]).not.toHaveProperty('settings');
  });

  it('drops a deleted phase together with its settings', () => {
    const edited = toEditablePhases(storedPhases).filter(
      (phase) => phase.id !== 'submission',
    );

    expect(toPhasesPayload(edited, storedPhases)).toEqual([
      expect.objectContaining({ phaseId: 'review' }),
    ]);
  });

  it('omits unchanged settings regardless of key order in the snapshot', () => {
    const reordered = [
      {
        ...storedPhases[0]!,
        settings: { allowProposals: true, budget: 25000 },
      },
    ];

    const payload = toPhasesPayload(toEditablePhases(storedPhases), reordered);

    expect(payload[0]).not.toHaveProperty('settings');
  });
});
