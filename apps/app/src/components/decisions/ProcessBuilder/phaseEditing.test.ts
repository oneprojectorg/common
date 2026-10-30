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

describe('phase editing never writes phase settings', () => {
  it('sends a phase edit without any settings, so the server keeps every stored budget', () => {
    const edited = toEditablePhases(storedPhases).map((phase) =>
      phase.id === 'submission' ? { ...phase, name: 'Applications' } : phase,
    );

    const payload = toPhasesPayload(edited);

    expect(payload[0]).toMatchObject({
      phaseId: 'submission',
      name: 'Applications',
    });
    for (const phase of payload) {
      expect(phase).not.toHaveProperty('settings');
    }
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
    });
  });

  it('drops a deleted phase from the payload', () => {
    const edited = toEditablePhases(storedPhases).filter(
      (phase) => phase.id !== 'submission',
    );

    expect(toPhasesPayload(edited)).toEqual([
      expect.objectContaining({ phaseId: 'review' }),
    ]);
  });
});
