import { describe, expect, it } from 'vitest';

import { getProcessAdminFixture } from './fixtures';
import { toTimelinePhases } from './toTimelinePhases';

describe('toTimelinePhases', () => {
  it('names the current phase for the timeline', () => {
    const { currentPhaseId } = toTimelinePhases(
      getProcessAdminFixture('live').phases,
    );

    expect(currentPhaseId).toBe('5b7e1a40-2c8f-4d3b-8e9a-000000000002');
  });

  it('passes an empty current id when no phase is current', () => {
    const { currentPhaseId } = toTimelinePhases(
      getProcessAdminFixture('draft').phases,
    );

    expect(currentPhaseId).toBe('');
  });

  it('maps dates, advancement and the proposals toggle', () => {
    const [first] = toTimelinePhases([
      {
        id: 'a',
        isCurrent: false,
        sortOrder: 0,
        name: 'Submit',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
        rules: {
          proposals: { submit: true },
          advancement: { method: 'manual' },
        },
      },
    ]).phases;

    expect(first).toEqual({
      id: 'a',
      name: 'Submit',
      description: undefined,
      phase: {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
      },
      advancementMethod: 'manual',
      config: { allowProposals: true },
    });
  });
});
