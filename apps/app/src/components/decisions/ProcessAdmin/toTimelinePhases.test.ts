import { describe, expect, it } from 'vitest';

import { toTimelinePhases } from './toTimelinePhases';
import type { ProcessAdminPhase } from './types';

const phase = (overrides: Partial<ProcessAdminPhase>): ProcessAdminPhase => ({
  id: 'a',
  isCurrent: false,
  sortOrder: 0,
  name: 'Submit',
  ...overrides,
});

describe('toTimelinePhases', () => {
  it('names the current phase for the timeline', () => {
    const { currentPhaseId } = toTimelinePhases([
      phase({ id: 'a' }),
      phase({ id: 'b', sortOrder: 1, isCurrent: true }),
    ]);

    expect(currentPhaseId).toBe('b');
  });

  it('passes an empty current id when no phase is current', () => {
    expect(toTimelinePhases([phase({})]).currentPhaseId).toBe('');
  });

  it('returns no phases for an empty list', () => {
    expect(toTimelinePhases([])).toEqual({ phases: [], currentPhaseId: '' });
  });

  it('maps dates, description, advancement and the proposals toggle', () => {
    const [first] = toTimelinePhases([
      phase({
        description: 'Send an idea',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
        rules: {
          proposals: { submit: true },
          advancement: { method: 'manual' },
        },
      }),
    ]).phases;

    expect(first).toEqual({
      id: 'a',
      name: 'Submit',
      description: 'Send an idea',
      phase: {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
      },
      advancementMethod: 'manual',
      config: { allowProposals: true },
    });
  });

  it('closes proposals when the phase does not take them', () => {
    const [first] = toTimelinePhases([
      phase({
        rules: {
          proposals: { submit: false },
          advancement: { method: 'date' },
        },
      }),
    ]).phases;

    expect(first?.config?.allowProposals).toBe(false);
    expect(first?.advancementMethod).toBe('date');
  });

  it('leaves the toggle and advancement unset for a phase without rules', () => {
    const [first] = toTimelinePhases([phase({})]).phases;

    expect(first?.config?.allowProposals).toBeUndefined();
    expect(first?.advancementMethod).toBeUndefined();
  });
});
